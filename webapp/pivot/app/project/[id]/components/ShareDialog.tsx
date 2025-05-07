import { useState, useEffect } from "react";
import { CheckCircle2, Copy, Loader2, School, Building, DoorOpen } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "../../../../components/ui/dialog";
import { Button } from "../../../../components/ui/button";
import { RadioGroup, RadioGroupItem } from "../../../../components/ui/radio-group";
import { useRouter } from 'next/navigation';
import { Project } from "../../../../hooks/useProject";
import { Label } from "../../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { createClient } from "@/utils/supabase/client";
import { 
  HOUSING_TYPES, 
  UNDERGRADUATE_RESIDENCE_TYPES, 
  GRADUATE_RESIDENCE_TYPES, 
  UNDERGRADUATE_RESIDENCES, 
  GRADUATE_RESIDENCES, 
  UNDERGRADUATE_ROOM_TYPES, 
  GRADUATE_ROOM_TYPES,
  UNDERGRADUATE_ROOM_TYPES_BY_HOUSE,
  UNDERGRADUATE_ROOM_TYPES_BY_RESIDENCE_TYPE
} from "../../../../lib/stanford-housing-data";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink: string;
  currentProject: Project | null;
  setProjects: (projects: Project[]) => void;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ 
  open, 
  onOpenChange, 
  shareLink, 
  currentProject, 
  setProjects 
}) => {
  const [copied, setCopied] = useState(false);
  const [isTogglingOrgAccess, setIsTogglingOrgAccess] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);
  const router = useRouter();
  const supabase = createClient();
  
  // Housing selection state
  const [housingType, setHousingType] = useState<string>("");
  const [residenceType, setResidenceType] = useState<string>("");
  const [residenceName, setResidenceName] = useState<string>("");
  const [roomType, setRoomType] = useState<string>("");

  // Store the available options based on previous selections
  const [availableResidenceTypes, setAvailableResidenceTypes] = useState<string[]>([]);
  const [availableResidences, setAvailableResidences] = useState<string[]>([]);
  const [availableRoomTypes, setAvailableRoomTypes] = useState<string[]>([]);

  // Reset selections when housing type changes
  useEffect(() => {
    if (housingType === "Undergraduate") {
      setAvailableResidenceTypes(UNDERGRADUATE_RESIDENCE_TYPES);
    } else if (housingType === "Graduate") {
      setAvailableResidenceTypes(GRADUATE_RESIDENCE_TYPES);
    } else {
      setAvailableResidenceTypes([]);
    }
    setResidenceType("");
    setResidenceName("");
    setRoomType("");
    setAvailableResidences([]);
    setAvailableRoomTypes([]);
  }, [housingType]);

  // Update available residences when residence type changes
  useEffect(() => {
    if (!residenceType) {
      setAvailableResidences([]);
      return;
    }

    if (housingType === "Undergraduate" && UNDERGRADUATE_RESIDENCES[residenceType]) {
      setAvailableResidences(UNDERGRADUATE_RESIDENCES[residenceType]);
    } else if (housingType === "Graduate" && GRADUATE_RESIDENCES[residenceType]) {
      setAvailableResidences(GRADUATE_RESIDENCES[residenceType]);
    } else {
      setAvailableResidences([]);
    }
    setResidenceName("");
    setRoomType("");
    setAvailableRoomTypes([]);
  }, [residenceType, housingType]);

  // Update available room types when residence name changes
  useEffect(() => {
    if (!residenceName) {
      setAvailableRoomTypes([]);
      return;
    }

    if (housingType === "Undergraduate") {
      if (UNDERGRADUATE_ROOM_TYPES_BY_HOUSE[residenceName]) {
        // If we have specific room types for this house
        setAvailableRoomTypes(UNDERGRADUATE_ROOM_TYPES_BY_HOUSE[residenceName]);
      } else if (UNDERGRADUATE_ROOM_TYPES_BY_RESIDENCE_TYPE[residenceType]) {
        // Fall back to room types for this residence type
        setAvailableRoomTypes(UNDERGRADUATE_ROOM_TYPES_BY_RESIDENCE_TYPE[residenceType]);
      } else {
        // Fall back to all undergraduate room types
        setAvailableRoomTypes(UNDERGRADUATE_ROOM_TYPES);
      }
    } else if (housingType === "Graduate") {
      // Get room types specific to this graduate residence if available
      const graduateRoomTypes = GRADUATE_ROOM_TYPES;
      setAvailableRoomTypes(graduateRoomTypes);
    } else {
      setAvailableRoomTypes([]);
    }
    setRoomType("");
  }, [residenceName, housingType, residenceType]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleRemoveFromOrg = async () => {
    if (!currentProject) return;
    
    setIsTogglingOrgAccess(true);
    
    try {
      // Remove from organization
      const { error } = await supabase
        .from("projects")
        .update({ 
          organization_id: null 
        })
        .eq("id", currentProject.id);
        
      if (error) throw error;
      
      // Update the projects list with the new data
      if (setProjects) {
        setProjects((prev) => {
          // Check if prev is an array (which it should be)
          if (Array.isArray(prev)) {
            return prev.map((p) => 
              p.id === currentProject.id
                ? { 
                    ...p, 
                    organization_id: null
                  }
                : p
            );
          }
          // If prev is not an array, just return it unchanged
          console.error("setProjects was called with a non-array value:", prev);
          return prev;
        });
      }
      
      // Close the dialog
      onOpenChange(false);
      
      // Force a refresh to get updated data
      router.refresh();
    } catch (error) {
      console.error("Error removing project from organization:", error);
      alert("Failed to remove project from organization");
    } finally {
      setIsTogglingOrgAccess(false);
    }
  };

  const handleAddToOrg = async () => {
    if (!currentProject) return;
    
    setIsTogglingOrgAccess(true);
    
    try {
      // Get the organization ID for the user's email domain
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      const domain = user.email?.split('@')[1];
      
      if (!domain) {
        throw new Error("Unable to determine user's email domain");
      }
      
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("id")
        .eq("domain_restriction", domain)
        .single();
        
      if (orgError) {
        throw new Error(`No organization found for domain ${domain}`);
      }
      
      // Save the housing data to the project's metadata
      const updatedMetadata = {
        ...currentProject.metadata,
        housing_type: housingType,
        residence_type: residenceType,
        residence_name: residenceName,
        room_type: roomType
      };
      
      // Update the project in the database
      const { error } = await supabase
        .from("projects")
        .update({ 
          organization_id: orgData.id,
          metadata: updatedMetadata
        })
        .eq("id", currentProject.id);
        
      if (error) throw error;
      
      // Update the projects in state
      if (setProjects) {
        setProjects((prev) => {
          // Check if prev is an array (which it should be)
          if (Array.isArray(prev)) {
            return prev.map((p) => 
              p.id === currentProject.id
                ? { 
                    ...p, 
                    organization_id: orgData.id,
                    metadata: updatedMetadata 
                  }
                : p
            );
          }
          // If prev is not an array, just return it unchanged
          console.error("setProjects was called with a non-array value:", prev);
          return prev;
        });
      }
      
      // Move to the final step showing the share link
      setActiveStep(5);
    } catch (error) {
      console.error("Error sharing project:", error);
      alert("Failed to share project: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsTogglingOrgAccess(false);
    }
  };

  const handleNext = () => {
    // Validate current step before proceeding
    if (activeStep === 1 && !housingType) {
      alert("Please select a housing type");
      return;
    }
    
    if (activeStep === 2 && !residenceType) {
      alert("Please select a residence type");
      return;
    }
    
    if (activeStep === 3 && !residenceName) {
      alert("Please select a residence");
      return;
    }
    
    if (activeStep === 4 && !roomType) {
      alert("Please select a room type");
      return;
    }
    
    setActiveStep(prev => prev + 1);
  };
  
  const handleBack = () => {
    setActiveStep(prev => Math.max(1, prev - 1));
  };

  // Reset state when dialog is opened/closed
  useEffect(() => {
    if (open) {
      // If the project already has housing data in its metadata, use that as initial values
      if (currentProject?.metadata) {
        const { housing_type, residence_type, residence_name, room_type } = currentProject.metadata;
        
        if (housing_type) {
          setHousingType(housing_type);
          // The rest of the values will be set by the useEffect hooks above
        }
        
        // If all housing data is present and project is in an organization, skip to the last step
        if (housing_type && residence_type && residence_name && room_type && currentProject.organization_id) {
          setActiveStep(5);
        }
      } else {
        // Reset to first step with no selections
        setActiveStep(1);
        setHousingType("");
        setResidenceType("");
        setResidenceName("");
        setRoomType("");
      }
    }
  }, [open, currentProject]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Share Project with Organization</DialogTitle>
          <DialogDescription className="text-white/70">
            {activeStep < 5 
              ? "Provide housing information before sharing your project with your organization." 
              : "Anyone in your organization can view this project with the link."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select Housing Type */}
        {activeStep === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Select Housing Type</h3>
            <RadioGroup 
              value={housingType} 
              onValueChange={setHousingType}
              className="grid grid-cols-2 gap-4"
            >
              {HOUSING_TYPES.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <RadioGroupItem value={type} id={`housing-${type}`} />
                  <Label htmlFor={`housing-${type}`} className="flex items-center">
                    <School className="mr-2 h-4 w-4" />
                    {type}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        {/* Step 2: Select Residence Type */}
        {activeStep === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Select Residence Type</h3>
            <p className="text-sm text-muted-foreground">
              {housingType === "Undergraduate" 
                ? "Choose the type of undergraduate housing" 
                : "Choose the type of graduate housing"}
            </p>
            
            <Select value={residenceType} onValueChange={setResidenceType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select residence type" />
              </SelectTrigger>
              <SelectContent>
                {availableResidenceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 3: Select Residence Name */}
        {activeStep === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Select Residence</h3>
            <p className="text-sm text-muted-foreground">
              Choose the specific building or residence
            </p>
            
            <Select value={residenceName} onValueChange={setResidenceName}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select residence" />
              </SelectTrigger>
              <SelectContent>
                {availableResidences.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 4: Select Room Type */}
        {activeStep === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Select Room Type</h3>
            <p className="text-sm text-muted-foreground">
              Choose the type of room in this residence
            </p>
            
            <Select value={roomType} onValueChange={setRoomType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select room type" />
              </SelectTrigger>
              <SelectContent>
                {availableRoomTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 5: Share Link */}
        {activeStep === 5 && (
          <>
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-primary/10">
                <h3 className="text-sm font-medium mb-2">Housing Information</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="flex items-center">
                    <School className="h-4 w-4 mr-2 text-primary" />
                    <span className="text-muted-foreground mr-1">Type:</span> {housingType}
                  </div>
                  <div className="flex items-center">
                    <Building className="h-4 w-4 mr-2 text-primary" />
                    <span className="text-muted-foreground mr-1">Building:</span> {residenceName}
                  </div>
                  <div className="flex items-center">
                    <Building className="h-4 w-4 mr-2 text-primary" />
                    <span className="text-muted-foreground mr-1">Category:</span> {residenceType}
                  </div>
                  <div className="flex items-center">
                    <DoorOpen className="h-4 w-4 mr-2 text-primary" />
                    <span className="text-muted-foreground mr-1">Room:</span> {roomType}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-md">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm text-white"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyToClipboard}
                  className="h-8"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
        
        <DialogFooter className="flex justify-between mt-4">
          {activeStep < 5 ? (
            <>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={activeStep === 1}
              >
                Back
              </Button>
              
              {activeStep === 4 ? (
                <Button 
                  onClick={handleAddToOrg}
                  disabled={isTogglingOrgAccess}
                  className="bg-cyber-gradient hover:opacity-90"
                >
                  {isTogglingOrgAccess ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sharing...
                    </>
                  ) : (
                    "Share with Organization"
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={handleNext}
                  className="bg-cyber-gradient hover:opacity-90"
                >
                  Next
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleRemoveFromOrg}
                disabled={isTogglingOrgAccess}
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
              >
                {isTogglingOrgAccess ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  "Remove from Organization"
                )}
              </Button>
              <Button
                onClick={() => {
                  window.open(shareLink, "_blank");
                }}
                className="text-white bg-cyber-gradient hover:opacity-90"
              >
                Open Shared View
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;