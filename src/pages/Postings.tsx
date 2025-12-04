import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Briefcase, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface JobPosting {
  id: string;
  job_title: string;
  career_level: string;
  location: string;
  department: string;
  key_skills: string[];
  natural_posting: string;
  created_at: string;
}

const Postings = () => {
  const navigate = useNavigate();
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPostings();
  }, []);

  const fetchPostings = async () => {
    try {
      const response = await api.getJobPostings();
      setPostings(response.postings || []);
    } catch (error) {
      console.error("Error fetching postings:", error);
      toast.error("Failed to load job postings");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary py-6 px-8 shadow-md mt-16">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary-foreground">Job Postings</h1>
            <p className="text-primary-foreground/80 mt-2">View and manage all active job postings</p>
          </div>
          <Button
            onClick={() => navigate("/create-posting")}
            className="bg-secondary hover:bg-secondary-hover"
          >
            <Plus className="mr-2 h-5 w-5" />
            Create New Posting
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : postings.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="pt-12 pb-12 text-center">
              <Briefcase className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Job Postings Yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first AI-powered job posting to get started
              </p>
              <Button onClick={() => navigate("/create-posting")} className="bg-secondary hover:bg-secondary-hover">
                <Plus className="mr-2 h-5 w-5" />
                Create First Posting
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {postings.map((posting) => (
              <Card key={posting.id} className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="text-xl">{posting.job_title}</CardTitle>
                  <p className="text-xs text-muted-foreground">Job ID: {posting.id}</p>

                  <Badge variant="secondary" className="w-fit mt-2">
                    {posting.career_level}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="mr-2 h-4 w-4" />
                    {posting.location}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Building2 className="mr-2 h-4 w-4" />
                    {posting.department}
                  </div>

                  {posting.key_skills && posting.key_skills.length > 0 && (
                    <div className="pt-2">
                      <p className="text-xs text-muted-foreground mb-2">Key Skills:</p>
                      <div className="flex flex-wrap gap-2">
                        {posting.key_skills.slice(0, 3).map((skill, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {posting.key_skills.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{posting.key_skills.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground pt-2">
                    Posted {posting.date_created ? new Date(posting.date_created).toLocaleDateString() : 'Unknown date'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Postings;
