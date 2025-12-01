import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Employee {
  id: string;
  name: string;
  department: string;
  current_role: string;
  similarity_score: number;
  promotion_probability: number;
  email: string;
}

const ReviewPosting = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isApproving, setIsApproving] = useState(false);
  const [similarEmployees, setSimilarEmployees] = useState<Employee[]>([]);

  const { generatedPosting, originalInput } = location.state || {};

  if (!generatedPosting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No posting data found. Please create a new posting.</p>
            <Button onClick={() => navigate("/create-posting")} className="w-full mt-4">
              Create New Posting
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const { data, error } = await supabase.functions.invoke("approve-posting", {
        body: {
          naturalPosting: generatedPosting.natural_posting,
          structuredData: generatedPosting.structured_data_string,
          originalInput,
        },
      });

      if (error) throw error;

      // Set similar employees if returned
      if (data?.similarEmployees) {
        setSimilarEmployees(data.similarEmployees);
        toast.success("Job posting approved and saved!");
      } else {
        toast.success("Job posting approved and saved!");
        navigate("/postings");
      }
    } catch (error) {
      console.error("Error approving posting:", error);
      toast.error("Failed to approve posting. Please try again.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleDisapprove = () => {
    toast.info("Posting disapproved");
    navigate("/create-posting");
  };

  const handleContactEmployee = (employee: Employee) => {
    window.location.href = `mailto:${employee.email}?subject=Job Opportunity - ${originalInput.jobTitle}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary py-6 px-8 shadow-md">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-primary-foreground">Review Job Posting</h1>
          <p className="text-primary-foreground/80 mt-2">Review and approve the AI-generated posting</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Generated Posting */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>📄 Generated Job Posting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {generatedPosting.natural_posting}
                </pre>
              </div>

              <div className="flex gap-4 mt-8">
                <Button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="flex-1 bg-success hover:bg-success/90"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Approve
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleDisapprove}
                  variant="destructive"
                  className="flex-1"
                >
                  <X className="mr-2 h-4 w-4" />
                  Disapprove
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Structured Data */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>📊 Structured Data</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[400px] text-xs">
                {JSON.stringify(JSON.parse(generatedPosting.structured_data_string), null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>

        {/* Similar Employees Section */}
        {similarEmployees.length > 0 && (
          <Card className="shadow-lg mt-8">
            <CardHeader>
              <CardTitle>👥 In-House Recruitment Recommendations</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Top employees similar to this role with promotion probability
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {similarEmployees.map((employee) => (
                  <Card key={employee.id} className="border-2">
                    <CardContent className="pt-6">
                      <h3 className="font-semibold text-lg mb-2">{employee.name}</h3>
                      <p className="text-sm text-muted-foreground mb-1">{employee.current_role}</p>
                      <p className="text-sm text-muted-foreground mb-4">{employee.department}</p>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Similarity</span>
                          <Badge variant="secondary">
                            {(employee.similarity_score * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Promotion Probability</span>
                          <Badge 
                            variant={employee.promotion_probability > 0.7 ? "default" : "outline"}
                            className={employee.promotion_probability > 0.7 ? "bg-success" : ""}
                          >
                            {(employee.promotion_probability * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      </div>

                      <Button 
                        onClick={() => handleContactEmployee(employee)}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Contact Employee
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ReviewPosting;
