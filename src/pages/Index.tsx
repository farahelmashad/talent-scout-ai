import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Briefcase, Users } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="bg-primary py-8 px-8 shadow-lg mt-16">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-foreground rounded-2xl mb-6">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-5xl font-bold text-primary-foreground mb-4">
            AI Job Posting Manager
          </h1>
          <p className="text-xl text-primary-foreground/90 max-w-2xl mx-auto">
            Transform your recruitment process with AI-powered job postings and intelligent employee matching
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid gap-8 md:grid-cols-2 mb-16">
          <div className="bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-center w-16 h-16 bg-secondary/10 rounded-xl mb-6">
              <Briefcase className="h-8 w-8 text-secondary" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Create Job Postings</h2>
            <p className="text-muted-foreground mb-6">
              Generate professional job postings using AI. Simply provide basic details and let our fine-tuned model create compelling postings.
            </p>
            <Button
              onClick={() => navigate("/create-posting")}
              className="w-full bg-secondary hover:bg-secondary-hover"
              size="lg"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Create Posting
            </Button>
          </div>

          <div className="bg-card rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-xl mb-6">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-4">View All Postings</h2>
            <p className="text-muted-foreground mb-6">
              Manage your active job postings and track applications. View detailed analytics and employee recommendations.
            </p>
            <Button
              onClick={() => navigate("/postings")}
              variant="outline"
              className="w-full"
              size="lg"
            >
              View Postings
            </Button>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-10 shadow-lg text-center">
          <h3 className="text-2xl font-bold mb-4">Key Features</h3>
          <div className="grid gap-6 md:grid-cols-3 mt-8">
            <div>
              <div className="text-4xl mb-3">🤖</div>
              <h4 className="font-semibold mb-2">AI-Powered Generation</h4>
              <p className="text-sm text-muted-foreground">
                Fine-tuned LLM creates professional postings
              </p>
            </div>
            <div>
              <div className="text-4xl mb-3">🎯</div>
              <h4 className="font-semibold mb-2">Smart Matching</h4>
              <p className="text-sm text-muted-foreground">
                Find similar employees for in-house recruitment
              </p>
            </div>
            <div>
              <div className="text-4xl mb-3">📊</div>
              <h4 className="font-semibold mb-2">Data-Driven Insights</h4>
              <p className="text-sm text-muted-foreground">
                Promotion probability predictions for employees
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
