// frontend/app/page.tsx
import { Activity, BrainCircuit, ShieldAlert, Wallet } from "lucide-react";

// 1. Define the TypeScript shape of our database rows
interface TicketLog {
  id: number;
  subject: string;
  body: string;
  engine: string;
  assigned_queue: string;
  confidence_score: number;
  latency_ms: number;
  cost_usd: number;
  created_at: string;
}

// 2. Fetch the data directly from your FastAPI backend
async function getTickets(): Promise<TicketLog[]> {
  // 'no-store' ensures the dashboard always fetches fresh data on reload
  const res = await fetch("http://backend:8000/api/v1/tickets/logs", {
    cache: "no-store",
  });
  
  if (!res.ok) {
    console.error("Failed to fetch tickets");
    return [];
  }
  return res.json();
}

// 3. Render the Dashboard UI
export default async function Dashboard() {
  const tickets = await getTickets();

  // Calculate live metrics
  const totalTickets = tickets.length;
  const mlTickets = tickets.filter((t) => t.engine === "Machine Learning");
  const llmTickets = tickets.filter((t) => t.engine.includes("LLM"));
  
  // Calculate cost avoided (Assuming ~150 tokens per ticket * $0.15 per 1M tokens)
  const averageLlmCostPerTicket = 0.0000225; 
  const cloudCostAvoided = mlTickets.length * averageLlmCostPerTicket;

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            IT Support Router Engine
          </h1>
          <p className="text-gray-500 mt-2">
            Live hybrid AI routing metrics and cloud cost analytics.
          </p>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Tickets"
            value={totalTickets.toString()}
            icon={<Activity className="text-blue-500" />}
          />
          <MetricCard
            title="Routed by ML (Fast/Free)"
            value={mlTickets.length.toString()}
            icon={<BrainCircuit className="text-green-500" />}
          />
          <MetricCard
            title="LLM Fallbacks"
            value={llmTickets.length.toString()}
            icon={<ShieldAlert className="text-amber-500" />}
          />
          <MetricCard
            title="Cloud Cost Avoided"
            value={`$${cloudCostAvoided.toFixed(5)}`}
            icon={<Wallet className="text-purple-500" />}
          />
        </div>

        {/* Live Ticket Feed */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {ticket.subject}
                  </p>
                  <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      ticket.engine.includes("ML") || ticket.engine === "Machine Learning" 
                        ? "bg-green-100 text-green-700" 
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {ticket.engine.split(' ')[0]} {/* Shows "Machine" or "LLM" */}
                    </span>
                    Routed to: <span className="font-semibold text-gray-700">{ticket.assigned_queue}</span>
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-mono text-gray-900">{ticket.latency_ms} ms</p>
                  <p className="text-xs text-gray-400 mt-1">{(ticket.confidence_score * 100).toFixed(1)}% Confidence</p>
                </div>
              </div>
            ))}
            
            {tickets.length === 0 && (
              <div className="px-6 py-8 text-center text-gray-500">
                No tickets processed yet. Send some through the API!
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}

// Reusable UI Component for the top cards
function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4">
      <div className="p-3 bg-gray-50 rounded-lg">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
    </div>
  );
}