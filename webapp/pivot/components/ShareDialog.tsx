import { useState, useEffect } from "react";
import { CheckCircle2, Copy, School } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  HOUSING_TYPES,
  UNDERGRADUATE_RESIDENCE_TYPES,
  GRADUATE_RESIDENCE_TYPES,
  UNDERGRADUATE_RESIDENCES,
  GRADUATE_RESIDENCES,
  UNDERGRADUATE_ROOM_TYPES,
  GRADUATE_ROOM_TYPES,
  UNDERGRADUATE_ROOM_TYPES_BY_HOUSE
} from "../lib/stanford-housing-data";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink: string;
  currentProject: any;
  handleToggleProjectOrg: (metadata?: any) => Promise<boolean>;
  handleUpdateMetadata: (metadata: any) => Promise<boolean>;
  isShared: boolean;
}

const getInitialStep = (isShared: boolean) => (isShared ? 5 : 1);

export default function ShareDialog({
  open,
  onOpenChange,
  shareLink,
  currentProject,
  handleToggleProjectOrg,
  handleUpdateMetadata,
  isShared,
}: ShareDialogProps) {
  // Stepper state
  const [step, setStep] = useState(getInitialStep(isShared));
  const [housingType, setHousingType] = useState<string>("");
  const [residenceType, setResidenceType] = useState<string>("");
  const [residence, setResidence] = useState<string>("");
  const [roomType, setRoomType] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Pre-fill from metadata if present
  useEffect(() => {
    if (currentProject?.metadata) {
      setHousingType(currentProject.metadata.housingType || "");
      setResidenceType(currentProject.metadata.residenceType || "");
      setResidence(currentProject.metadata.residence || "");
      setRoomType(currentProject.metadata.roomType || "");
    }
    setStep(getInitialStep(isShared));
  }, [currentProject, isShared, open]);

  // Step 1: Housing Type
  const housingTypeOptions = HOUSING_TYPES;

  // Step 2: Residence Type
  const residenceTypeOptions =
    housingType === "Undergraduate"
      ? UNDERGRADUATE_RESIDENCE_TYPES
      : housingType === "Graduate"
      ? GRADUATE_RESIDENCE_TYPES
      : [];

  // Step 3: Residence
  const residenceOptions =
    housingType === "Undergraduate"
      ? (UNDERGRADUATE_RESIDENCES as Record<string, string[]>)[residenceType] || []
      : housingType === "Graduate"
      ? (GRADUATE_RESIDENCES as Record<string, string[]>)[residenceType] || []
      : [];

  // Step 4: Room Type
  let roomTypeOptions: string[] = [];
  if (housingType === "Undergraduate") {
    roomTypeOptions = (UNDERGRADUATE_ROOM_TYPES_BY_HOUSE as Record<string, string[]>)[residence] || UNDERGRADUATE_ROOM_TYPES;
  } else if (housingType === "Graduate") {
    roomTypeOptions = GRADUATE_ROOM_TYPES;
  }

  const canGoNext = () => {
    if (step === 1) return !!housingType;
    if (step === 2) return !!residenceType;
    if (step === 3) return !!residence;
    if (step === 4) return !!roomType;
    return true;
  };

  const handleNext = () => {
    if (step < 5 && canGoNext()) setStep(step + 1);
  };
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const metadata = {
        housingType,
        residenceType,
        residence,
        roomType,
      };
      const success = await handleToggleProjectOrg(metadata);
      if (success) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error sharing project:", error);
    } finally {
      setIsSharing(false);
    }
  };

  // Stepper content
  let content = null;
  if (step === 1) {
    content = (
      <div className="space-y-4">
        <Label>Housing Type</Label>
        <select
          className="w-full p-2 rounded bg-muted/30 text-white"
          value={housingType}
          onChange={e => {
            setHousingType(e.target.value);
            setResidenceType("");
            setResidence("");
            setRoomType("");
          }}
        >
          <option value="">Select housing type</option>
          {housingTypeOptions.map((type: string) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
    );
  } else if (step === 2) {
    content = (
      <div className="space-y-4">
        <Label>Residence Type</Label>
        <select
          className="w-full p-2 rounded bg-muted/30 text-white"
          value={residenceType}
          onChange={e => {
            setResidenceType(e.target.value);
            setResidence("");
            setRoomType("");
          }}
        >
          <option value="">Select residence type</option>
          {residenceTypeOptions.map((type: string) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
    );
  } else if (step === 3) {
    content = (
      <div className="space-y-4">
        <Label>Residence</Label>
        <select
          className="w-full p-2 rounded bg-muted/30 text-white"
          value={residence}
          onChange={e => {
            setResidence(e.target.value);
            setRoomType("");
          }}
        >
          <option value="">Select residence</option>
          {residenceOptions.map((res: string) => (
            <option key={res} value={res}>{res}</option>
          ))}
        </select>
      </div>
    );
  } else if (step === 4) {
    content = (
      <div className="space-y-4">
        <Label>Room Type</Label>
        <select
          className="w-full p-2 rounded bg-muted/30 text-white"
          value={roomType}
          onChange={e => setRoomType(e.target.value)}
        >
          <option value="">Select room type</option>
          {roomTypeOptions.map((rt: string) => (
            <option key={rt} value={rt}>{rt}</option>
          ))}
        </select>
      </div>
    );
  } else if (step === 5) {
    content = (
      <>
        <div className="flex items-center space-y-4 bg-muted/30 p-4 rounded-md mb-4">
          <School className="h-5 w-5 text-primary mr-2" />
          <div className="flex-1">
            <h3 className="font-medium">Stanford University</h3>
            <p className="text-sm text-muted-foreground">
              Shared with all Stanford users
            </p>
          </div>
        </div>
        <div className="mb-4">
          <div><b>Housing Type:</b> {housingType}</div>
          <div><b>Residence Type:</b> {residenceType}</div>
          <div><b>Residence:</b> {residence}</div>
          <div><b>Room Type:</b> {roomType}</div>
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
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background text-white">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isShared ? 'Unshare from Organization' : 'Share with Organization'}
          </DialogTitle>
          <DialogDescription className="text-white/70">
            {isShared
              ? 'This project is currently shared with Stanford University. Other Stanford users can find and view this project.'
              : 'Share this project with Stanford University. Other Stanford users will be able to find and view this project.'}
          </DialogDescription>
        </DialogHeader>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span>Step {step} of 5</span>
            {step > 1 && step < 5 && (
              <Button size="sm" variant="ghost" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>
          {content}
        </div>
        <DialogFooter className="mt-4">
          {step < 5 && (
            <Button
              onClick={handleNext}
              disabled={!canGoNext()}
              className="text-white bg-cyber-gradient hover:opacity-90"
            >
              Next
            </Button>
          )}
          {step === 5 && !isShared && (
            <Button
              onClick={handleShare}
              disabled={isSharing}
              className="text-white bg-cyber-gradient hover:opacity-90"
            >
              {isSharing ? "Sharing..." : "Share with Stanford"}
            </Button>
          )}
          {step === 5 && isShared && (
            <Button
              onClick={handleShare}
              disabled={isSharing}
              className="text-white bg-red-500 hover:bg-red-600"
            >
              {isSharing ? "Processing..." : "Unshare from Stanford"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 