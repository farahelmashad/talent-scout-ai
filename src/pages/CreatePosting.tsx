import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const CreatePosting = () => {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    jobTitle: "",
    careerLevel: "",
    location: "",
    department: "",
    keySkills: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.jobTitle || !formData.careerLevel || !formData.location || !formData.department) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsGenerating(true);
    try {
      const data = await api.generateJobPosting({
        jobTitle: formData.jobTitle,
        careerLevel: formData.careerLevel,
        location: formData.location,
        department: formData.department,
        keySkills: formData.keySkills,
      });

      // Navigate to review page with the generated data
      navigate("/review-posting", {
        state: {
          generatedPosting: data,
          originalInput: formData
        }
      });
    } catch (error) {
      console.error("Error generating posting:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate job posting";
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary py-6 px-8 shadow-md mt-16">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-primary-foreground">AI Job Posting Generator</h1>
          <p className="text-primary-foreground/80 mt-2">Create intelligent job postings with AI assistance</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Create New Job Posting</CardTitle>
            <CardDescription>
              Fill in the details below and let AI generate a professional job posting for you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title *</Label>
                <Input
                  id="jobTitle"
                  placeholder="e.g., Machine Learning Intern"
                  value={formData.jobTitle}
                  onChange={(e) => handleInputChange("jobTitle", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="careerLevel">Career Level *</Label>
                <Input
                  id="careerLevel"
                  placeholder="e.g., Intern, Junior, Senior"
                  value={formData.careerLevel}
                  onChange={(e) => handleInputChange("careerLevel", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  placeholder="e.g., Cairo, Egypt"
                  value={formData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Input
                  id="department"
                  placeholder="e.g., Tech, Marketing, Sales"
                  value={formData.department}
                  onChange={(e) => handleInputChange("department", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keySkills">Key Skills (Optional)</Label>
              <Textarea
                id="keySkills"
                placeholder="e.g., Python, Machine Learning, Data Analysis"
                className="min-h-[100px]"
                value={formData.keySkills}
                onChange={(e) => handleInputChange("keySkills", e.target.value)}
              />
            </div>

            <div className="flex gap-4">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 bg-secondary hover:bg-secondary-hover"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Job Posting
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate("/postings")}
              >
                View Postings
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CreatePosting;
