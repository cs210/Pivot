import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Users, Eye, Clock } from "lucide-react";

interface ViewStats {
  totalViews: number;
  uniqueViews: number;
  averageDuration: number;
  totalDuration: number;
}

export default function ProjectAnalytics({ projectId }: { projectId: string }) {
  const [stats, setStats] = useState<ViewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/views/stats`);
        if (!response.ok) throw new Error('Failed to fetch stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching view stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [projectId]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (loading) {
    return (
      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading analytics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background/80 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="h-5 w-5" />
          Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-muted/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Total Views</h3>
              </div>
              <p className="text-2xl font-bold">{stats?.totalViews || 0}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Unique Viewers</h3>
              </div>
              <p className="text-2xl font-bold">{stats?.uniqueViews || 0}</p>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Average View Duration</h3>
              </div>
              <p className="text-2xl font-bold">
                {stats?.averageDuration ? formatDuration(stats.averageDuration) : '0s'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Total View Time</h3>
              </div>
              <p className="text-2xl font-bold">
                {stats?.totalDuration ? formatDuration(stats.totalDuration) : '0s'}
              </p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
} 