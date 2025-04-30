"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@/utils/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    HOUSING_TYPES,
    UNDERGRADUATE_RESIDENCE_TYPES,
    GRADUATE_RESIDENCE_TYPES,
    GRADUATE_RESIDENCES,
    UNDERGRADUATE_RESIDENCES,
    UNDERGRADUATE_ROOM_TYPES,
    GRADUATE_ROOM_TYPES,
} from "@/lib/stanford-housing-data"; // Assuming you have a file with these constants

export default function ExplorePage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [user, setUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [organization, setOrganization] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  
  // Filter states
  const [housingType, setHousingType] = useState<string | null>(null);
  const [selectedResidenceTypes, setSelectedResidenceTypes] = useState<string[]>([]);
  const [selectedResidenceNames, setSelectedResidenceNames] = useState<string[]>([]);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>([]);
  
  // Available options based on current selection
  const [availableResidenceTypes, setAvailableResidenceTypes] = useState<string[]>([]);
  const [availableResidences, setAvailableResidences] = useState<string[]>([]);
  const [availableRoomTypes, setAvailableRoomTypes] = useState<string[]>([]);

  // Check user authentication status
  useEffect(() => {
    const checkUser = async () => {
      try {
        setUserLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        console.log("Auth user data:", user); // Log user data for debugging
        setUser(user);
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
        
        console.log("Loading organization. User:", user); // Debug log
        
        // If no user is logged in, show the no-access screen immediately
        if (!user) {
          console.log("No user logged in"); // Debug log
          setOrganization(null);
          setProjects([]);
          setFilteredProjects([]);
          setIsLoading(false);
          return;
        }
        
        // Check if user has a stanford.edu email
        const isStanfordUser = user.email && user.email.endsWith('stanford.edu');
        console.log("User email:", user.email, "Is Stanford user:", isStanfordUser); // Debug log
        
        // Get Stanford organization regardless of email domain for debugging
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('domain_restriction', 'stanford.edu')
          .single();
          
        console.log("Stanford organization data:", orgData, "Error:", orgError); // Debug log
        
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
            
          console.log("Projects data:", projectsData, "Error:", projectsError); // Debug log
          
          if (projectsError) {
            console.error('Error fetching projects:', projectsError);
            setProjects([]);
            setFilteredProjects([]);
          } else {
            setProjects(projectsData || []);
            setFilteredProjects(projectsData || []);
            
            // Initialize available options
            const housingTypes = new Set<string>();
            const residenceTypes = new Set<string>();
            const residenceNames = new Set<string>();
            const roomTypes = new Set<string>();
            
            projectsData?.forEach((project: any) => {
              if (project.metadata?.housing_type) housingTypes.add(project.metadata.housing_type);
              if (project.metadata?.residence_type) residenceTypes.add(project.metadata.residence_type);
              if (project.metadata?.residence_name) residenceNames.add(project.metadata.residence_name);
              if (project.metadata?.room_type) roomTypes.add(project.metadata.room_type);
            });
            
            // If no projects exist yet, use our predefined options
            if (housingTypes.size === 0) {
              setAvailableResidenceTypes(housingType === 'Undergraduate' ? 
                UNDERGRADUATE_RESIDENCE_TYPES : 
                housingType === 'Graduate' ? 
                  GRADUATE_RESIDENCE_TYPES : 
                  []);
            } else {
              setAvailableResidenceTypes(Array.from(residenceTypes));
            }
          }
        }
      } catch (error) {
        console.error('Error loading organization:', error);
        // Ensure we exit loading state even on error
        setOrganization(null);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadOrganization();
  }, [user, userLoading, housingType]);
  
  // Update available residences when housing type changes
  useEffect(() => {
    if (housingType === 'Undergraduate') {
      setAvailableResidenceTypes(UNDERGRADUATE_RESIDENCE_TYPES);
      
      // For room types, use the general list
      setAvailableRoomTypes(UNDERGRADUATE_ROOM_TYPES);
      
      // Initially show all residences
      const allResidences = Object.values(UNDERGRADUATE_RESIDENCES).flat();
      setAvailableResidences([...new Set(allResidences)]); // Remove duplicates
    } else if (housingType === 'Graduate') {
      setAvailableResidenceTypes(GRADUATE_RESIDENCE_TYPES);
      
      // For room types, use the general list
      setAvailableRoomTypes(GRADUATE_ROOM_TYPES);
      
      // Initially show all residences
      const allResidences = Object.values(GRADUATE_RESIDENCES).flat();
      setAvailableResidences([...new Set(allResidences)]); // Remove duplicates
    } else {
      setAvailableResidenceTypes([]);
      setAvailableResidences([]);
      setAvailableRoomTypes([]);
    }
    
    // Reset filters when housing type changes
    setSelectedResidenceTypes([]);
    setSelectedResidenceNames([]);
    setSelectedRoomTypes([]);
  }, [housingType]);

  // Update available residences when residence type changes
  useEffect(() => {
    if (!selectedResidenceTypes.length) {
      setAvailableResidences([]);
      return;
    }
    
    if (housingType === 'Undergraduate') {
      const residences = selectedResidenceTypes.flatMap(type => {
        const residenceKey = type as keyof typeof UNDERGRADUATE_RESIDENCES;
        return UNDERGRADUATE_RESIDENCES[residenceKey] || [];
      });
      setAvailableResidences([...new Set(residences)]); // Remove duplicates
    } else if (housingType === 'Graduate') {
      const residences = selectedResidenceTypes.flatMap(type => {
        const residenceKey = type as keyof typeof GRADUATE_RESIDENCES;
        return GRADUATE_RESIDENCES[residenceKey] || [];
      });
      setAvailableResidences([...new Set(residences)]); // Remove duplicates
    } else {
      setAvailableResidences([]);
    }
    
    // We no longer reset dependent filters here, allowing selections to persist
  }, [selectedResidenceTypes, housingType]);

  // Update available residences when residence types selection changes
  useEffect(() => {
    if (housingType === 'Undergraduate' || housingType === 'Graduate') {
      // If no residence types are selected, show all residences
      if (selectedResidenceTypes.length === 0) {
        const allResidences = housingType === 'Undergraduate'
          ? Object.values(UNDERGRADUATE_RESIDENCES).flat()
          : Object.values(GRADUATE_RESIDENCES).flat();
          
        setAvailableResidences([...new Set(allResidences)]); // Remove duplicates
      } else {
        // Otherwise, show only residences from selected residence types
        const residences = selectedResidenceTypes.flatMap(type => {
          if (housingType === 'Undergraduate') {
            const residenceKey = type as keyof typeof UNDERGRADUATE_RESIDENCES;
            return UNDERGRADUATE_RESIDENCES[residenceKey] || [];
          } else { // Graduate
            const residenceKey = type as keyof typeof GRADUATE_RESIDENCES;
            return GRADUATE_RESIDENCES[residenceKey] || [];
          }
        });
        
        setAvailableResidences([...new Set(residences)]); // Remove duplicates
      }
    }
  }, [selectedResidenceTypes, housingType]);

  // Apply filters when they change
  useEffect(() => {
    if (!projects.length) return;
    
    const filtered = projects.filter((project: any) => {
      // Filter by housing metadata
      const metadata = project.metadata || {};
      
      if (housingType && metadata.housing_type !== housingType) return false;
      
      // For multi-select filters, check if any selected option matches
      if (selectedResidenceTypes.length > 0 && !selectedResidenceTypes.includes(metadata.residence_type)) return false;
      if (selectedResidenceNames.length > 0 && !selectedResidenceNames.includes(metadata.residence_name)) return false;
      if (selectedRoomTypes.length > 0 && !selectedRoomTypes.includes(metadata.room_type)) return false;
      
      return true;
    });
    
    setFilteredProjects(filtered);
  }, [projects, housingType, selectedResidenceTypes, selectedResidenceNames, selectedRoomTypes]);
  
  // Reset all filters
  const resetFilters = () => {
    setHousingType(null);
    setSelectedResidenceTypes([]);
    setSelectedResidenceNames([]);
    setSelectedRoomTypes([]);
  };
  
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
      <div className="container mx-auto p-8">
        <Alert className="mb-8">
          <AlertTitle>Organization Access Required</AlertTitle>
          <AlertDescription>
            Sorry, your email domain doesn&apos;t have access to any organizations in our system.
            Currently, we only support Stanford University (stanford.edu email addresses).
          </AlertDescription>
        </Alert>
        
        <Button onClick={() => router.push('/')}>Return to Home</Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">Explore {organization.name}</h1>
      <div className="flex justify-between items-center mb-8">
        <p className="text-gray-500">Browse and filter housing projects</p>
        <Button onClick={() => router.push('/')} variant="outline" className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-home"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          Return to Home
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Panel */}
        <div className="col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Narrow your search</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Housing Type */}
              <div className="space-y-2">
                <Label htmlFor="housingType">Housing Type</Label>
                <Select 
                  value={housingType || undefined} 
                  onValueChange={setHousingType}
                >
                  <SelectTrigger id="housingType">
                    <SelectValue placeholder="Select housing type" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUSING_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Residence Type - Multiple Selection */}
              {housingType && (
                <div className="space-y-2">
                  <Label>Residence Types</Label>
                  <div className="space-y-2 border p-3 rounded-md">
                    {availableResidenceTypes.map(type => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`residenceType-${type}`}
                          checked={selectedResidenceTypes.includes(type)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              // Add this residence type
                              setSelectedResidenceTypes(prev => [...prev, type]);
                              
                              // Also select all residences of this type
                              const residencesOfType = housingType === 'Undergraduate' 
                                ? UNDERGRADUATE_RESIDENCES[type as keyof typeof UNDERGRADUATE_RESIDENCES] || []
                                : GRADUATE_RESIDENCES[type as keyof typeof GRADUATE_RESIDENCES] || [];
                                
                              setSelectedResidenceNames(prev => {
                                // Create a new array with all previously selected residences
                                const newSelection = [...prev];
                                
                                // Add each residence from this type if not already selected
                                residencesOfType.forEach(residence => {
                                  if (!newSelection.includes(residence)) {
                                    newSelection.push(residence);
                                  }
                                });
                                
                                return newSelection;
                              });
                            } else {
                              // Remove this residence type
                              setSelectedResidenceTypes(prev => prev.filter(t => t !== type));
                              
                              // Also remove all residences belonging to this type
                              const residencesOfType = housingType === 'Undergraduate' 
                                ? UNDERGRADUATE_RESIDENCES[type as keyof typeof UNDERGRADUATE_RESIDENCES] || []
                                : GRADUATE_RESIDENCES[type as keyof typeof GRADUATE_RESIDENCES] || [];
                                
                              setSelectedResidenceNames(prev => 
                                prev.filter(name => !residencesOfType.includes(name))
                              );
                            }
                          }}
                        />
                        <Label htmlFor={`residenceType-${type}`} className="cursor-pointer">{type}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Residence Name - Multiple Selection */}
              {housingType && (
                <div className="space-y-2">
                  <Label>Residences</Label>
                  <div className="space-y-2 border p-3 rounded-md max-h-48 overflow-y-auto">
                    {availableResidences.map(name => (
                      <div key={name} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`residenceName-${name}`}
                          checked={selectedResidenceNames.includes(name)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedResidenceNames(prev => [...prev, name]);
                            } else {
                              setSelectedResidenceNames(prev => prev.filter(n => n !== name));
                            }
                          }}
                        />
                        <Label htmlFor={`residenceName-${name}`} className="cursor-pointer">{name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Room Type - Multiple Selection */}
              {housingType && (
                <div className="space-y-2">
                  <Label>Room Types</Label>
                  <div className="space-y-2 border p-3 rounded-md max-h-48 overflow-y-auto">
                    {availableRoomTypes.map(type => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`roomType-${type}`}
                          checked={selectedRoomTypes.includes(type)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedRoomTypes(prev => [...prev, type]);
                            } else {
                              setSelectedRoomTypes(prev => prev.filter(t => t !== type));
                            }
                          }}
                        />
                        <Label htmlFor={`roomType-${type}`} className="cursor-pointer">{type}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Separator className="my-4" />
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={resetFilters} className="w-full">
                Reset Filters
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* Projects Grid */}
        <div className="col-span-1 lg:col-span-3">
          {filteredProjects.length === 0 ? (
            <div className="text-center p-12 border rounded-lg">
              <h3 className="text-lg font-medium">No projects found</h3>
              <p className="text-gray-500 mt-2">
                Try adjusting your filters or create a new project.
              </p>
              <Button onClick={() => router.push('/project/new')} className="mt-4">
                Create New Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => (
                <Card key={project.id} className="cursor-pointer hover:shadow-md transition-shadow duration-200" onClick={() => viewProject(project.id)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription>
                      {project.metadata?.residence_name || 'Unknown Residence'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      {project.metadata?.housing_type && (
                        <div><span className="font-medium">Type:</span> {project.metadata.housing_type}</div>
                      )}
                      {project.metadata?.room_type && (
                        <div><span className="font-medium">Room:</span> {project.metadata.room_type}</div>
                      )}
                      {project.is_public && (
                        <div className="text-green-600 mt-2">Public Project</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}