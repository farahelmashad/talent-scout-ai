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

// Promotion model API endpoint
const PROMOTION_MODEL_URL = Deno.env.get('PROMOTION_MODEL_URL') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting approve-posting function...');
    
    const { naturalPosting, structuredData, originalInput } = await req.json();
    console.log('📥 Received request data');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const parsedData = JSON.parse(structuredData);
    
    // Process skills into array
    const skills = typeof parsedData.skills === 'string' 
      ? parsedData.skills.split(',').map((s: string) => s.trim())
      : parsedData.skills || [];
    
    console.log('💾 Saving to Supabase...');
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

    if (error) {
      console.error('❌ Supabase insert error:', error);
      throw error;
    }
    console.log('✅ Saved to Supabase:', posting.id);

    // Create embedding text for job posting
    const embeddingText = createEmbeddingText(parsedData, naturalPosting);
    console.log('📝 Created embedding text, length:', embeddingText.length);
    
    // First, let's check what embedding dimensions your Qdrant collection expects
    console.log('🔍 Checking Qdrant collection configuration...');
    const collectionInfo = await checkQdrantCollection();
    console.log('📊 Qdrant collection info:', JSON.stringify(collectionInfo, null, 2));
    
    // Get embedding
    console.log('🔄 Getting embedding...');
    const embedding = await getEmbedding(embeddingText, collectionInfo.vectorSize);
    console.log('✅ Got embedding, dimensions:', embedding.length);
    
    // Process departments
    const departmentKeywords = processDepartments(parsedData.job_categories || '');
    const primaryDepartment = departmentKeywords[0] || 'General';

    console.log('📤 Uploading to Qdrant...');
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
      console.error('❌ Qdrant job posting upload failed:', errorText);
      throw new Error(`Qdrant job posting upload failed: ${errorText}`);
    }

    console.log('✅ Job posting uploaded to Qdrant');

    // Query Qdrant for similar employees
    console.log('🔍 Querying Qdrant for similar employees...');
    const similarEmployeesData = await querySimilarEmployees(embedding);

    console.log(`✅ Found ${similarEmployeesData.length} similar employees`);

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
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('❌ ERROR in approve-posting:', errorMessage);
    console.error('Stack trace:', errorStack);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Check Qdrant collection to see what dimensions it expects
async function checkQdrantCollection(): Promise<{ vectorSize: number }> {
  try {
    const response = await fetch(
      `${QDRANT_URL}/collections/${JOB_POSTINGS_COLLECTION}`,
      {
        method: 'GET',
        headers: {
          'api-key': QDRANT_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to get collection info, assuming 384 dimensions');
      return { vectorSize: 384 };
    }

    const data = await response.json();
    const vectorSize = data.result?.config?.params?.vectors?.size || 384;
    console.log(`Collection expects ${vectorSize} dimensions`);
    return { vectorSize };
  } catch (error) {
    console.error('Error checking collection:', error);
    return { vectorSize: 384 };
  }
}

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

// Simplified embedding function with better error messages
async function getEmbedding(text: string, targetDimensions: number): Promise<number[]> {
  console.log(`🔄 Generating ${targetDimensions}D embedding...`);
  console.log('Checking for API keys...');

  // Check which API keys are available
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  const COHERE_API_KEY = Deno.env.get('COHERE_API_KEY');
  
  console.log('Available keys:', {
    openai: OPENAI_API_KEY ? '✅ Set' : '❌ Not set',
    cohere: COHERE_API_KEY ? '✅ Set' : '❌ Not set'
  });

  // Try OpenAI first
  if (OPENAI_API_KEY) {
    try {
      console.log('Attempting OpenAI embedding...');
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.slice(0, 8000), // Limit text length
          dimensions: targetDimensions
        }),
      });

      console.log('OpenAI response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI error response:', errorText);
        throw new Error(`OpenAI API failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const embedding = data.data[0].embedding;
      
      console.log('✅ OpenAI embedding successful! Dimensions:', embedding.length);
      return embedding;
      
    } catch (error) {
      console.error('❌ OpenAI embedding failed:', error);
      // Continue to try Cohere
    }
  }

  // Try Cohere
  if (COHERE_API_KEY) {
    try {
      console.log('Attempting Cohere embedding...');
      
      // Cohere models and their dimensions
      const cohereModel = targetDimensions === 384 
        ? 'embed-english-light-v3.0' 
        : 'embed-english-v3.0';
      
      const response = await fetch('https://api.cohere.ai/v1/embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${COHERE_API_KEY}`,
        },
        body: JSON.stringify({
          texts: [text.slice(0, 8000)],
          model: cohereModel,
          input_type: 'search_document',
          truncate: 'END'
        }),
      });

      console.log('Cohere response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cohere error response:', errorText);
        throw new Error(`Cohere API failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      let embedding = data.embeddings[0];
      
      // Adjust dimensions if needed
      if (embedding.length > targetDimensions) {
        embedding = embedding.slice(0, targetDimensions);
      } else if (embedding.length < targetDimensions) {
        // Pad with zeros
        embedding = [...embedding, ...new Array(targetDimensions - embedding.length).fill(0)];
      }
      
      console.log('✅ Cohere embedding successful! Dimensions:', embedding.length);
      return embedding;
      
    } catch (error) {
      console.error('❌ Cohere embedding failed:', error);
      throw error;
    }
  }

  throw new Error(`
    ❌ NO EMBEDDING API CONFIGURED!
    
    Please add one of these to your Supabase Edge Function secrets:
    - OPENAI_API_KEY (recommended)
    - COHERE_API_KEY (has free tier)
    
    Go to: Supabase Dashboard → Project Settings → Edge Functions → Add secret
  `);
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