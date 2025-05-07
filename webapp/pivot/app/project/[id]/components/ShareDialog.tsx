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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../../../components/ui/select";
import { useRouter } from 'next/navigation';
import { Project } from "../../../../hooks/useProject";
import { Label } from "../../../../components/ui/label";
import { 
  HOUSING_TYPES, 
  UNDERGRADUATE_RESIDENCE_TYPES, 
  GRADUATE_RESIDENCE_TYPES, 
  UNDERGRADUATE_RESIDENCES, 
  GRADUATE_RESIDENCES, 
  UNDERGRADUATE_ROOM_TYPES, 
  GRADUATE_ROOM_TYPES
} from "../../../../lib/stanford-housing-data";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink: string;
  currentProject: Project | null;
  handleToggleProjectOrg?: (metadata?: any) => Promise<boolean>;
  handleUpdateMetadata?: (metadata: any) => Promise<boolean>;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ 
  open, 
  onOpenChange, 
  shareLink, 
  currentProject, 
  handleToggleProjectOrg,
  handleUpdateMetadata
}) => {
  const [copied, setCopied] = useState(false);
  const [isTogglingOrgAccess, setIsTogglingOrgAccess] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const router = useRouter();
  
  // Housing selection state - simplified
  const [housingType, setHousingType] = useState<string>("");
  const [residenceType, setResidenceType] = useState<string>("");
  const [residenceName, setResidenceName] = useState<string>("");
  const [roomType, setRoomType] = useState<string>("");
  
  // Initialize housing information from project metadata when dialog opens
  useEffect(() => {
    if (open && currentProject?.metadata) {
      setHousingType(currentProject.metadata.housing_type || "");
      setResidenceType(currentProject.metadata.residence_type || "");
      setResidenceName(currentProject.metadata.residence_name || "");
      setRoomType(currentProject.metadata.room_type || "");
      
      // If project has housing metadata, go directly to step 5 (share link)
      if (currentProject.metadata.housing_type) {
        setActiveStep(5);
      }
    } else if (open) {
      // Reset form when opening for a new project
      setHousingType("");
      setResidenceType("");
      setResidenceName("");
      setRoomType("");
      setActiveStep(1);
    }
    
    // Always reset edit mode when dialog opens/closes
    setIsEditMode(false);
  }, [open, currentProject]);
  
  // Modified for filtering residences by type
  const getFilteredResidences = () => {
    if (!residenceType) return [];
    
    if (housingType === "Undergraduate") {
      // Return only residences that match the selected type
      return UNDERGRADUATE_RESIDENCES[residenceType as keyof typeof UNDERGRADUATE_RESIDENCES] || [];
    } else if (housingType === "Graduate") {
      return GRADUATE_RESIDENCES[residenceType as keyof typeof GRADUATE_RESIDENCES] || [];
    }
    
    return [];
  };
  
  // Get the filtered residences based on the selected residence type
  const filteredResidences = getFilteredResidences();

  // Get room types specific to the selected residence
  const getFilteredRoomTypes = (): string[] => {
    if (!residenceName) return [];
    
    if (housingType === "Undergraduate") {
      // Check if there are specific room types for this house
      const UNDERGRADUATE_ROOM_TYPES_BY_HOUSE = require("../../../../lib/stanford-housing-data").UNDERGRADUATE_ROOM_TYPES_BY_HOUSE;
      if (UNDERGRADUATE_ROOM_TYPES_BY_HOUSE[residenceName]) {
        return UNDERGRADUATE_ROOM_TYPES_BY_HOUSE[residenceName];
      }
      
      // Fall back to room types for this residence type
      const UNDERGRADUATE_ROOM_TYPES_BY_RESIDENCE_TYPE = require("../../../../lib/stanford-housing-data").UNDERGRADUATE_ROOM_TYPES_BY_RESIDENCE_TYPE;
      if (residenceType && UNDERGRADUATE_ROOM_TYPES_BY_RESIDENCE_TYPE[residenceType]) {
        return UNDERGRADUATE_ROOM_TYPES_BY_RESIDENCE_TYPE[residenceType];
      }
      
      // If no specific room types are found, return all undergraduate room types
      return UNDERGRADUATE_ROOM_TYPES;
    } else if (housingType === "Graduate") {
      // Get room types specific to this graduate residence
      const GRADUATE_ROOM_TYPES_BY_RESIDENCE = require("../../../../lib/stanford-housing-data").GRADUATE_ROOM_TYPES_BY_RESIDENCE;
      if (GRADUATE_ROOM_TYPES_BY_RESIDENCE[residenceName]) {
        return GRADUATE_ROOM_TYPES_BY_RESIDENCE[residenceName];
      }
      
      // Fall back to all graduate room types
      return GRADUATE_ROOM_TYPES;
    }
    
    return [];
  };
  
  // Get filtered room types based on selected residence
  const filteredRoomTypes = getFilteredRoomTypes();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleRemoveFromOrg = async () => {
    if (!handleToggleProjectOrg) return;
    
    setIsTogglingOrgAccess(true);
    
    try {
      await handleToggleProjectOrg();
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Error removing project from organization:", error);
      alert("Failed to remove project from organization");
    } finally {
      setIsTogglingOrgAccess(false);
    }
  };

  const handleAddToOrg = async () => {
    if (!currentProject || !handleToggleProjectOrg) return;
    
    setIsTogglingOrgAccess(true);
    
    try {
      // Create the housing metadata object
      const housingMetadata = {
        housing_type: housingType,
        residence_type: residenceType,
        residence_name: residenceName,
        room_type: roomType
      };
      
      console.log("Adding project to org with metadata:", housingMetadata);
      
      // Pass the metadata directly to handleToggleProjectOrg
      const orgSuccess = await handleToggleProjectOrg(housingMetadata);
      
      if (!orgSuccess) {
        throw new Error("Failed to add project to organization");
      }
      
      setActiveStep(5);
    } catch (error) {
      console.error("Error sharing project:", error);
      alert("Failed to share project");
    } finally {
      setIsTogglingOrgAccess(false);
    }
  };

  const handleSaveMetadata = async () => {
    if (!currentProject || !handleUpdateMetadata) return;
    
    setIsSavingMetadata(true);
    
    try {
      // Create the updated housing metadata object
      const updatedMetadata = {
        ...currentProject.metadata, // Preserve any existing metadata
        housing_type: housingType,
        residence_type: residenceType,
        residence_name: residenceName,
        room_type: roomType
      };
      
      console.log("Updating project metadata:", updatedMetadata);
      
      // Use the dedicated metadata update function that doesn't affect org status
      const success = await handleUpdateMetadata(updatedMetadata);
      
      if (!success) {
        throw new Error("Failed to update housing information");
      }
      
      // Exit edit mode after successful save
      setIsEditMode(false);
    } catch (error) {
      console.error("Error updating housing information:", error);
      alert("Failed to update housing information");
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleNext = () => {
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
                {housingType === "Undergraduate" 
                  ? UNDERGRADUATE_RESIDENCE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))
                  : GRADUATE_RESIDENCE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))
                }
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
            
            <Select value={residenceName} onValueChange={(value) => {
              setResidenceName(value);
              // Reset room type when residence changes
              setRoomType("");
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select residence" />
              </SelectTrigger>
              <SelectContent>
                {filteredResidences.map((name) => (
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
                {filteredRoomTypes.map((type: string) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Step 5: Share Link */}
        {activeStep === 5 && !isEditMode && (
          <>
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-primary/10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Housing Information</h3>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setIsEditMode(true)}
                    className="h-7 px-2"
                  >
                    Edit
                  </Button>
                </div>
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
        
        {/* Step 5 - Edit Mode */}
        {activeStep === 5 && isEditMode && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Edit Housing Type</h3>
              <RadioGroup 
                value={housingType} 
                onValueChange={(value) => {
                  setHousingType(value);
                  setResidenceType("");
                  setResidenceName("");
                  setRoomType("");
                }}
                className="grid grid-cols-2 gap-4"
              >
                {HOUSING_TYPES.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <RadioGroupItem value={type} id={`housing-edit-${type}`} />
                    <Label htmlFor={`housing-edit-${type}`} className="flex items-center">
                      <School className="mr-2 h-4 w-4" />
                      {type}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Edit Residence Type</h3>
              <p className="text-sm text-muted-foreground">
                {housingType === "Undergraduate" 
                  ? "Choose the type of undergraduate housing" 
                  : "Choose the type of graduate housing"}
              </p>
              
              <Select value={residenceType} onValueChange={(value) => {
                setResidenceType(value);
                setResidenceName("");
                setRoomType("");
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select residence type" />
                </SelectTrigger>
                <SelectContent>
                  {housingType === "Undergraduate" 
                    ? UNDERGRADUATE_RESIDENCE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))
                    : GRADUATE_RESIDENCE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Edit Residence</h3>
              <p className="text-sm text-muted-foreground">
                Choose the specific building or residence
              </p>
              
              <Select value={residenceName} onValueChange={(value) => {
                setResidenceName(value);
                setRoomType("");
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select residence" />
                </SelectTrigger>
                <SelectContent>
                  {filteredResidences.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Edit Room Type</h3>
              <p className="text-sm text-muted-foreground">
                Choose the type of room in this residence
              </p>
              
              <Select value={roomType} onValueChange={setRoomType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  {filteredRoomTypes.map((type: string) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
          ) : isEditMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditMode(false)}
                disabled={isSavingMetadata}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveMetadata}
                disabled={isSavingMetadata || !housingType || !residenceType || !residenceName || !roomType}
                className="bg-cyber-gradient hover:opacity-90"
              >
                {isSavingMetadata ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
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