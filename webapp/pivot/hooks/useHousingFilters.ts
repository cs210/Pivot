import { useState, useEffect } from 'react';
import {
  HOUSING_TYPES,
  UNDERGRADUATE_RESIDENCE_TYPES,
  GRADUATE_RESIDENCE_TYPES,
  GRADUATE_RESIDENCES,
  UNDERGRADUATE_RESIDENCES,
  UNDERGRADUATE_ROOM_TYPES,
  GRADUATE_ROOM_TYPES,
} from "@/lib/stanford-housing-data";

export type Project = {
  id: string;
  name: string;
  metadata?: {
    housing_type?: string;
    residence_type?: string;
    residence_name?: string;
    room_type?: string;
  };
  is_public?: boolean;
  created_at?: string;
  [key: string]: any;
};

export function useHousingFilters(projects: Project[]) {
  // Filter states
  const [housingType, setHousingType] = useState<string | null>(null);
  const [selectedResidenceTypes, setSelectedResidenceTypes] = useState<string[]>([]);
  const [selectedResidenceNames, setSelectedResidenceNames] = useState<string[]>([]);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<string[]>([]);
  
  // Available options based on current selection
  const [availableResidenceTypes, setAvailableResidenceTypes] = useState<string[]>([]);
  const [availableResidences, setAvailableResidences] = useState<string[]>([]);
  const [availableRoomTypes, setAvailableRoomTypes] = useState<string[]>([]);
  
  // Filtered projects
  const [filteredProjects, setFilteredProjects] = useState<Project[]>(projects);

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
    
    const filtered = projects.filter((project: Project) => {
      // Filter by housing metadata
      const metadata = project.metadata || {};
      
      if (housingType && metadata.housing_type !== housingType) return false;
      
      // For multi-select filters, check if any selected option matches
      if (selectedResidenceTypes.length > 0 && !selectedResidenceTypes.includes(metadata.residence_type || '')) return false;
      if (selectedResidenceNames.length > 0 && !selectedResidenceNames.includes(metadata.residence_name || '')) return false;
      if (selectedRoomTypes.length > 0 && !selectedRoomTypes.includes(metadata.room_type || '')) return false;
      
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
  
  // Handle selecting a residence type
  const handleResidenceTypeChange = (type: string, checked: boolean) => {
    if (checked) {
      // Add this residence type
      setSelectedResidenceTypes(prev => [...prev, type]);
      
      // No longer auto-selecting all residences of this type
      // This allows users to see all relevant residences but select only those they want
    } else {
      // Remove this residence type
      setSelectedResidenceTypes(prev => prev.filter(t => t !== type));
      
      // Remove any selected residences that are no longer available
      const remainingResidenceTypes = selectedResidenceTypes.filter(t => t !== type);
      
      if (remainingResidenceTypes.length === 0) {
        // If no residence types remain, don't filter residences
        return;
      }
      
      // Get all residences from remaining selected residence types
      const availableResidenceSet = new Set(
        remainingResidenceTypes.flatMap(resType => {
          if (housingType === 'Undergraduate') {
            const residenceKey = resType as keyof typeof UNDERGRADUATE_RESIDENCES;
            return UNDERGRADUATE_RESIDENCES[residenceKey] || [];
          } else { // Graduate
            const residenceKey = resType as keyof typeof GRADUATE_RESIDENCES;
            return GRADUATE_RESIDENCES[residenceKey] || [];
          }
        })
      );
      
      // Keep only the residences that are still available
      setSelectedResidenceNames(prev => 
        prev.filter(name => availableResidenceSet.has(name))
      );
    }
  };

  return {
    // States
    housingType,
    setHousingType,
    selectedResidenceTypes,
    setSelectedResidenceTypes,
    selectedResidenceNames,
    setSelectedResidenceNames,
    selectedRoomTypes,
    setSelectedRoomTypes,
    availableResidenceTypes,
    availableResidences,
    availableRoomTypes,
    filteredProjects,
    
    // Helper functions
    resetFilters,
    handleResidenceTypeChange
  };
}