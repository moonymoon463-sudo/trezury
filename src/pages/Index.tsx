import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">GoldSpend</h1>
            <p className="text-muted-foreground">Welcome back, {user?.email}</p>
          </div>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio</CardTitle>
              <CardDescription>Your gold holdings and balance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0.00 g</div>
              <p className="text-sm text-muted-foreground">≈ $0.00 USD</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Buy Gold</CardTitle>
              <CardDescription>Convert fiat to tokenized gold</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Buy Gold</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sell Gold</CardTitle>
              <CardDescription>Convert gold back to fiat</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Sell Gold</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send</CardTitle>
              <CardDescription>Send gold to other users</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Send Gold</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Card</CardTitle>
              <CardDescription>Spend gold with a card</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>KYC Status</CardTitle>
              <CardDescription>Verification status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                  Pending
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Your latest activity</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground py-8">
              No transactions yet. Start by buying some gold!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
