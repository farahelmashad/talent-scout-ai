import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Mail, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

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

      if (error) {
        console.error("❌ Supabase function error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));

        // The Supabase client doesn't expose the response body in errors
        // We need to check Supabase logs for the actual error message
        const errorMessage = "Edge Function returned an error. Check Supabase logs for details.";
        toast.error(errorMessage);
        console.error("💡 TIP: Go to Supabase Dashboard → Edge Functions → approve-posting → Logs to see the actual error");
        throw error;
      }

      // Check if response contains an error (even with 200 status)
      if (data?.error) {
        console.error("❌ Function returned error:", data.error);
        console.error("Error details:", data.details);
        console.error("Error stack:", data.stack);
        const errorMsg = data.error || "Unknown error occurred";
        toast.error(`Error: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Set similar employees if returned
      if (data?.similarEmployees) {
        setSimilarEmployees(data.similarEmployees);
        toast.success("Job posting approved and saved!");
      } else {
        toast.success("Job posting approved and saved!");
        navigate("/postings");
      }
    } catch (error) {
      console.error("❌ Error approving posting:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Full error object:", error);

      // More helpful error message
      if (errorMessage.includes("non-2xx")) {
        toast.error("Server error occurred. Please check Supabase logs for details.");
        console.error("💡 To see the actual error:");
        console.error("   1. Go to Supabase Dashboard");
        console.error("   2. Edge Functions → approve-posting → Logs");
        console.error("   3. Look for messages with ❌");
      } else {
        toast.error(`Failed to approve posting: ${errorMessage}`);
      }
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
        {/* Generated Posting - Full Width */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">📄 Generated Job Posting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-slate max-w-none dark:prose-invert">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-3xl font-bold mb-4 text-foreground">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-2xl font-semibold mb-3 mt-6 text-foreground">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-xl font-semibold mb-2 mt-4 text-foreground">{children}</h3>,
                  p: ({ children }) => <p className="mb-4 text-foreground leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc ml-6 mb-4 space-y-2 text-foreground">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 space-y-2 text-foreground">{children}</ol>,
                  li: ({ children }) => <li className="text-foreground">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                  em: ({ children }) => <em className="italic text-foreground">{children}</em>,
                }}
              >
                {generatedPosting.natural_posting}
              </ReactMarkdown>
            </div>

            <div className="flex gap-4 mt-8 pt-6 border-t">
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
                    Approve & Post
                  </>
                )}
              </Button>

              <Button
                onClick={handleDisapprove}
                variant="destructive"
                className="flex-1"
              >
                <X className="mr-2 h-4 w-4" />
                Reject & Revise
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Similar Employees Section */}
        {similarEmployees.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">In-House Recruitment Recommendations</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Top talent matches from your existing workforce
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {similarEmployees.map((employee) => (
                  <Card key={employee.id} className="border-2 hover:border-primary/50 transition-all hover:shadow-md">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-lg mb-1">{employee.name}</h3>
                          <p className="text-sm font-medium text-primary">{employee.current_role}</p>
                          <p className="text-xs text-muted-foreground mt-1">{employee.department}</p>
                        </div>
                      </div>

                      <div className="space-y-3 mb-4 p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Role Match Score</span>
                          <Badge variant="secondary" className="font-semibold">
                            {(employee.similarity_score * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${employee.similarity_score * 100}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <span className="text-xs font-medium text-muted-foreground">Promotion Readiness</span>
                          <Badge
                            variant={employee.promotion_probability > 0.7 ? "default" : "outline"}
                            className={employee.promotion_probability > 0.7 ? "bg-success font-semibold" : "font-semibold"}
                          >
                            {(employee.promotion_probability * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-success h-1.5 rounded-full transition-all"
                            style={{ width: `${employee.promotion_probability * 100}%` }}
                          />
                        </div>
                      </div>

                      <Button
                        onClick={() => handleContactEmployee(employee)}
                        className="w-full bg-primary hover:bg-primary/90"
                        size="sm"
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
