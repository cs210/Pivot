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
  const meta = project.metadata || {};
  const residence = (meta as any).residence || (meta as any).residence_name || project.name;
  const housingType = (meta as any).housingType || (meta as any).housing_type;
  const roomType = (meta as any).roomType || (meta as any).room_type;
  return (
    <Card 
      key={project.id} 
      className="cursor-pointer hover:shadow-md transition-shadow duration-200 rounded-2xl border border-gray-200 bg-[#f7f5f2]"
      onClick={() => onClick(project.id)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold">{residence}</CardTitle>
        <CardDescription className="text-lg mt-2">
          {(meta as any).residence ? project.name : residence}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-lg">
          {housingType && (
            <div>Type: {housingType}</div>
          )}
          {roomType && (
            <div>Room: {roomType}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}