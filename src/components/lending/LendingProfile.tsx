import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPositions } from "./UserPositions";

export function SimpleLendingProfile() {
  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Lending Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <UserPositions />
        </CardContent>
      </Card>
    </div>
  );
}