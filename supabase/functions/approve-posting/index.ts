import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Qdrant configuration
const QDRANT_URL = Deno.env.get('QDRANT_URL')!;
const QDRANT_API_KEY = Deno.env.get('QDRANT_API_KEY')!;
const JOB_POSTINGS_COLLECTION = 'job_postings_cluster';
const EMPLOYEES_COLLECTION = 'employees';

// Hugging Face API for embeddings
const HF_API_KEY = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN')!;
const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';

// Promotion model API endpoint
const PROMOTION_MODEL_URL = Deno.env.get('PROMOTION_MODEL_URL') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { naturalPosting, structuredData, originalInput } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const parsedData = JSON.parse(structuredData);
    
    // Process skills into array
    const skills = typeof parsedData.skills === 'string' 
      ? parsedData.skills.split(',').map((s: string) => s.trim())
      : parsedData.skills || [];
    
    // Save to Supabase
    const { data: posting, error } = await supabaseClient
      .from('job_postings')
      .insert({
        job_title: originalInput.jobTitle,
        career_level: originalInput.careerLevel,
        location: originalInput.location,
        department: originalInput.department,
        key_skills: originalInput.keySkills ? originalInput.keySkills.split(',').map((s: string) => s.trim()) : [],
        natural_posting: naturalPosting,
        structured_data: parsedData,
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Saved to Supabase:', posting.id);

    // Create embedding text for job posting
    const embeddingText = createEmbeddingText(parsedData, naturalPosting);
    console.log('📝 Created embedding text, length:', embeddingText.length);
    
    // Get embedding from Hugging Face
    console.log('🔄 Getting embedding from Hugging Face...');
    const embedding = await getEmbedding(embeddingText);
    console.log('✅ Got embedding, dimensions:', embedding.length);
    
    // Process departments
    const departmentKeywords = processDepartments(parsedData.job_categories || '');
    const primaryDepartment = departmentKeywords[0] || 'General';

    // Upload job posting to Qdrant
    const qdrantPayload = {
      points: [{
        id: posting.id,
        vector: embedding,
        payload: {
          job_id: posting.id,
          status: 'active',
          date_created: new Date().toISOString().split('T')[0],
          title: parsedData.title,
          company: parsedData.company,
          job_type: parsedData.job_type,
          work_setting: parsedData.work_setting,
          location: parsedData.location,
          experience_needed: parsedData.experience_needed,
          career_level: parsedData.career_level,
          education_level: parsedData.education_level,
          job_categories: departmentKeywords,
          department: primaryDepartment,
          skills: skills,
          job_description: naturalPosting,
          job_requirements: naturalPosting,
          embedding_text: embeddingText
        }
      }]
    };

    const qdrantResponse = await fetch(
      `${QDRANT_URL}/collections/${JOB_POSTINGS_COLLECTION}/points?wait=true`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'api-key': QDRANT_API_KEY,
        },
        body: JSON.stringify(qdrantPayload),
      }
    );

    if (!qdrantResponse.ok) {
      const errorText = await qdrantResponse.text();
      console.error('Qdrant job posting upload failed:', errorText);
      throw new Error(`Qdrant job posting upload failed: ${errorText}`);
    }

    console.log('✅ Job posting uploaded to Qdrant');

    // Query Qdrant for similar employees
    console.log('🔍 Querying Qdrant for similar employees...');
    const similarEmployeesData = await querySimilarEmployees(embedding);

    console.log(`✅ Found ${similarEmployeesData.length} similar employees`);
    if (similarEmployeesData.length > 0) {
      console.log('First match:', JSON.stringify(similarEmployeesData[0]));
    }

    // Get promotion predictions for matched employees
    let similarEmployees = similarEmployeesData;
    
    if (PROMOTION_MODEL_URL && similarEmployeesData.length > 0) {
      try {
        similarEmployees = await addPromotionPredictions(similarEmployeesData);
        console.log('✅ Added promotion predictions');
      } catch (error) {
        console.error('⚠️ Promotion prediction failed, using similarity only:', error);
      }
    } else {
      console.log('⚠️ No promotion model URL configured, using mock predictions');
      similarEmployees = similarEmployeesData.map(emp => ({
        ...emp,
        promotion_probability: Math.random() * 0.4 + 0.6
      }));
    }

    return new Response(JSON.stringify({ 
      posting, 
      similarEmployees,
      qdrant_upload_success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in approve-posting:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper functions
function createEmbeddingText(structuredData: any, naturalPosting: string): string {
  const skills = typeof structuredData.skills === 'string'
    ? structuredData.skills
    : Array.isArray(structuredData.skills)
    ? structuredData.skills.join(', ')
    : '';

  return `
Job Title: ${structuredData.title}
Job Type: ${structuredData.job_type}
Work Setting: ${structuredData.work_setting}
Location: ${structuredData.location}
Experience Level: ${structuredData.experience_needed}
Career Level: ${structuredData.career_level}
Education Required: ${structuredData.education_level}
Department/Categories: ${structuredData.job_categories}
Required Skills: ${skills}

Job Description:
${naturalPosting}

Job Requirements:
${naturalPosting}
  `.trim();
}

function processDepartments(rawCategories: string): string[] {
  const processedString = rawCategories
    .replace(/ - /g, ',')
    .replace(/ \/ /g, ',')
    .replace(/\//g, ',')
    .replace(/-/g, ',');
  
  const keywords = processedString
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);
  
  return keywords.length > 0 ? keywords : ['General'];
}

async function getEmbedding(text: string): Promise<number[]> {
  console.log('🔄 Calling HuggingFace Serverless Inference API...');
  
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${EMBEDDING_MODEL}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        inputs: text,
        options: {
          wait_for_model: true
        }
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('HuggingFace API error:', errorText);
    throw new Error(`Embedding API failed: ${errorText}`);
  }

  const result = await response.json();
  console.log('✅ HuggingFace response type:', typeof result, 'isArray:', Array.isArray(result));
  
  // Case 1: Array of arrays (batch format) [[0.1, 0.2, ...]]
  if (Array.isArray(result) && Array.isArray(result[0])) {
    if (Array.isArray(result[0][0])) {
      // Token-level embeddings: need mean pooling
      console.log('✅ Token embeddings detected, performing mean pooling...');
      return meanPool(result[0]);
    } else if (typeof result[0][0] === 'number') {
      // Sentence-level embedding: take first
      console.log('✅ Sentence embedding (batch format), dimension:', result[0].length);
      return result[0];
    }
  }
  
  // Case 2: Direct 1D array [0.1, 0.2, ...]
  if (Array.isArray(result) && typeof result[0] === 'number') {
    console.log('✅ Direct embedding array, dimension:', result.length);
    return result;
  }
  
  console.error('Unexpected response structure:', JSON.stringify(result).slice(0, 300));
  throw new Error(`Unexpected embedding response format. Type: ${typeof result}, IsArray: ${Array.isArray(result)}`);
}

function meanPool(tokenEmbeddings: number[][]): number[] {
  if (!tokenEmbeddings || tokenEmbeddings.length === 0) {
    throw new Error('Empty token embeddings');
  }
  
  const embeddingDim = tokenEmbeddings[0].length;
  const meanEmbedding = new Array(embeddingDim).fill(0);
  
  for (const tokenEmb of tokenEmbeddings) {
    for (let i = 0; i < embeddingDim; i++) {
      meanEmbedding[i] += tokenEmb[i];
    }
  }
  
  for (let i = 0; i < embeddingDim; i++) {
    meanEmbedding[i] /= tokenEmbeddings.length;
  }
  
  console.log('✅ Mean pooled embedding dimension:', meanEmbedding.length);
  return meanEmbedding;
}

async function querySimilarEmployees(jobEmbedding: number[]): Promise<any[]> {
  const searchPayload = {
    vector: jobEmbedding,
    limit: 5,
    with_payload: true,
    score_threshold: 0.5
  };

  const response = await fetch(
    `${QDRANT_URL}/collections/${EMPLOYEES_COLLECTION}/points/search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': QDRANT_API_KEY,
      },
      body: JSON.stringify(searchPayload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qdrant employee search failed: ${errorText}`);
  }

  const result = await response.json();
  
  const employees = result.result.map((item: any) => ({
    id: item.id,
    name: item.payload.name || 'Unknown',
    department: item.payload.department || 'Unknown',
    current_role: item.payload.current_role || item.payload.designation || 'Unknown',
    email: item.payload.email || `employee${item.id}@company.com`,
    similarity_score: item.score,
    previous_year_rating: item.payload.previous_year_rating || 0,
    length_of_service: item.payload.length_of_service || 0,
    awards_won: item.payload.awards_won || 0,
    no_of_trainings: item.payload.no_of_trainings || 0,
    avg_training_score: item.payload.avg_training_score || 0,
    KPIs_met_more_than_80: item.payload.KPIs_met_more_than_80 || 0,
  }));

  return employees;
}

async function addPromotionPredictions(employees: any[]): Promise<any[]> {
  const employeeFeatures = employees.map(emp => ({
    previous_year_rating: emp.previous_year_rating,
    length_of_service: emp.length_of_service,
    awards_won: emp.awards_won,
    no_of_trainings: emp.no_of_trainings,
    avg_training_score: emp.avg_training_score,
    KPIs_met_more_than_80: emp.KPIs_met_more_than_80,
    department: emp.department
  }));

  const response = await fetch(PROMOTION_MODEL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ employees: employeeFeatures }),
  });

  if (!response.ok) {
    throw new Error('Promotion prediction API failed');
  }

  const predictions = await response.json();

  return employees.map((emp, index) => ({
    ...emp,
    promotion_probability: predictions[index]?.probability || 0.5,
  }));
}