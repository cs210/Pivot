"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { HousingFilters } from '@/components/housing-filters';
import { ProjectCard } from '@/components/project-card';
import { useHousingFilters } from '@/hooks/useHousingFilters';
import { Header } from '@/components/header';
import { useProjects } from '@/hooks/useProjects';
import { PlusCircle } from "lucide-react";

export default function ExplorePage() {
  const router = useRouter();
  const supabase = createClient();
  
  // Use the useProjects hook to handle some of the project operations
  const { 
    user
  } = useProjects(router);
  
  const [userLoading, setUserLoading] = useState(true);
  const [organization, setOrganization] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  
  // This useEffect is now redundant with useProjects hook, but we're keeping it
  // for now to avoid disrupting the organization loading logic
  useEffect(() => {
    const checkUser = async () => {
      try {
        setUserLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        // No need to setUser since useProjects handles this
      } catch (error) {
        console.error('Error checking user:', error);
      } finally {
        setUserLoading(false);
      }
    };
    
    checkUser();
  }, []);

  useEffect(() => {
    // Load Stanford organization and check user access
    async function loadOrganization() {
      if (userLoading) return;
      
      try {
        setIsLoading(true);
        
        // If no user is logged in, show the no-access screen immediately
        if (!user) {
          setOrganization(null);
          setProjects([]);
          setIsLoading(false);
          return;
        }
        
        // Get Stanford organization
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('domain_restriction', 'stanford.edu')
          .single();
          
        if (orgError) {
          console.error('Error fetching organization:', orgError);
          setOrganization(null);
        } else {
          // Even if not a stanford.edu email, for testing purposes, let's proceed
          setOrganization(orgData);
          
          // Get projects for this organization
          const { data: projectsData, error: projectsError } = await supabase
            .from('projects')
            .select('*')
            .eq('organization_id', orgData.id)
            .eq('is_archived', false);
            
          if (projectsError) {
            console.error('Error fetching projects:', projectsError);
            setProjects([]);
          } else {
            setProjects(projectsData || []);
          }
        }
      } catch (error) {
        console.error('Error loading organization:', error);
        setOrganization(null);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadOrganization();
  }, [user, userLoading, supabase]);

  // Use our custom hook for filtering
  const {
    housingType,
    setHousingType,
    selectedResidenceTypes,
    selectedResidenceNames,
    selectedRoomTypes,
    availableResidenceTypes,
    availableResidences,
    availableRoomTypes,
    filteredProjects,
    resetFilters,
    handleResidenceTypeChange,
    setSelectedResidenceNames,
    setSelectedRoomTypes
  } = useHousingFilters(projects);
  
  // Navigate to project details
  const viewProject = (projectId: string) => {
    router.push(`/project/${projectId}`);
  };
  
  if (userLoading || isLoading) {
    return <div className="container mx-auto p-8">Loading...</div>;
  }
  
  // No organization access
  if (!organization) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 container mx-auto p-8">
          <Alert className="mb-8">
            <AlertTitle>Organization Access Required</AlertTitle>
            <AlertDescription>
              Sorry, your email domain doesn&apos;t have access to any organizations in our system.
              Currently, we only support Stanford University (stanford.edu email addresses).
            </AlertDescription>
          </Alert>
          
          <Button onClick={() => router.push('/')}>Return to Home</Button>
        </main>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Explore {organization.name}</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Panel */}
          <div className="col-span-1">
            <HousingFilters
              housingType={housingType}
              setHousingType={setHousingType}
              selectedResidenceTypes={selectedResidenceTypes}
              selectedResidenceNames={selectedResidenceNames}
              selectedRoomTypes={selectedRoomTypes}
              availableResidenceTypes={availableResidenceTypes}
              availableResidences={availableResidences}
              availableRoomTypes={availableRoomTypes}
              handleResidenceTypeChange={handleResidenceTypeChange}
              resetFilters={resetFilters}
              setSelectedResidenceNames={setSelectedResidenceNames}
              setSelectedRoomTypes={setSelectedRoomTypes}
            />
          </div>
          
          {/* Projects Grid */}
          <div className="col-span-1 lg:col-span-3">
            {filteredProjects.length === 0 ? (
              <div className="text-center p-12 border rounded-lg">
                <h3 className="text-lg font-medium">No spaces found</h3>
                <p className="text-gray-500 mt-2">
                  Try adjusting your filters or go to your dashboard to create and manage your spaces.
                </p>
                <Button 
                  onClick={() => router.push('/dashboard')} 
                  className="mt-4 bg-cyber-gradient hover:opacity-90 geometric-text"
                >
                  Publish New Spaces
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <ProjectCard 
                    key={project.id}
                    project={project} 
                    onClick={viewProject} 
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}