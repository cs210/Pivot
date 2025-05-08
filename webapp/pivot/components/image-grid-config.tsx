"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Grid, Save, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GridConfigProps {
  onApplyConfig: (rows: number, cols: number) => void;
  currentRows: number;
  currentCols: number;
}

export function ImageGridConfig({
  onApplyConfig,
  currentRows,
  currentCols,
}: GridConfigProps) {
  const [rows, setRows] = useState(currentRows);
  const [cols, setCols] = useState(currentCols);

  const handleApplyConfig = () => {
    // Validate that we have at least 1 row and column
    const finalRows = Math.max(1, Math.min(rows, 10));
    const finalCols = Math.max(1, Math.min(cols, 10));

    // Apply the configuration
    onApplyConfig(finalRows, finalCols);
  };

  return (
    <Card className="bg-background/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center space-x-2">
          <Grid className="h-5 w-5" />
          <span>Grid Configuration</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="grid-rows">Rows</Label>
            <Input
              id="grid-rows"
              type="number"
              min={1}
              max={10}
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grid-cols">Columns</Label>
            <Input
              id="grid-cols"
              type="number"
              min={1}
              max={10}
              value={cols}
              onChange={(e) => setCols(parseInt(e.target.value) || 1)}
            />
          </div>
        </div>

        <div className="flex space-x-2 mt-6">
          <Button
            onClick={handleApplyConfig}
            className="flex-1 bg-cyber-gradient"
          >
            <Save className="mr-2 h-4 w-4" />
            Apply Configuration
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setRows(currentRows);
              setCols(currentCols);
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
