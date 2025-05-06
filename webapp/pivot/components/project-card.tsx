import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Project } from '@/hooks/useHousingFilters';

interface ProjectCardProps {
  project: Project;
  onClick: (projectId: string) => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <Card 
      key={project.id} 
      className="cursor-pointer hover:shadow-md transition-shadow duration-200" 
      onClick={() => onClick(project.id)}
    >
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
  );
}