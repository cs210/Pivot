import React from 'react';
import {
  Card,
  CardContent,
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
import { HOUSING_TYPES } from "@/lib/stanford-housing-data";

interface HousingFiltersProps {
  housingType: string | null;
  setHousingType: (type: string) => void;
  selectedResidenceTypes: string[];
  selectedResidenceNames: string[];
  selectedRoomTypes: string[];
  availableResidenceTypes: string[];
  availableResidences: string[];
  availableRoomTypes: string[];
  handleResidenceTypeChange: (type: string, checked: boolean) => void;
  resetFilters: () => void;
  setSelectedResidenceNames: (fn: (prev: string[]) => string[]) => void;
  setSelectedRoomTypes: (fn: (prev: string[]) => string[]) => void;
}

export function HousingFilters({
  housingType,
  setHousingType,
  selectedResidenceTypes,
  selectedResidenceNames,
  selectedRoomTypes,
  availableResidenceTypes,
  availableResidences,
  availableRoomTypes,
  handleResidenceTypeChange,
  resetFilters,
  setSelectedResidenceNames,
  setSelectedRoomTypes
}: HousingFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
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
                      handleResidenceTypeChange(type, checked === true);
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
  );
}