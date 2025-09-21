import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SimpleValidationStatus() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Validation Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          System validation temporarily disabled during lending system rebuild.
        </div>
      </CardContent>
    </Card>
  );
}