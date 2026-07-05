"use client";

import { Activity, BrainCircuit, ShieldAlert, Wallet, LogOut, Send } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface TicketLog {
  id: number;
  subject: string;
  body: string;
  engine: string;
  assigned_queue: string;
  confidence_score: number;
  latency_ms: number;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Dashboard State
  const [tickets, setTickets] = useState<TicketLog[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Protect the route: if not logged in, kick them to /login
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Fetch tickets on load
  const fetchTickets = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/tickets/logs");
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (error) {
      console.error("Failed to fetch tickets", error);
    }
  };

  useEffect(() => {
    if (status === "authenticated") fetchTickets();
  }, [status]);

  // Handle Form Submission
  const submitTicket = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!subject || !body) return;
    
    setIsSubmitting(true);
    try {
      await fetch("http://localhost:8000/api/v1/tickets/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Pass the JWT Token securely to FastAPI!
          "Authorization": `Bearer ${(session as any)?.accessToken}`
        },
        body: JSON.stringify({ subject, body }),
      });
      
      setSubject("");
      setBody("");
      fetchTickets(); // Refresh the list instantly
    } catch (error) {
      console.error("Error submitting ticket", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  if (!session) return null;

  // Analytics
  const mlTickets = tickets.filter((t) => t.engine === "Machine Learning");
  const cloudCostAvoided = mlTickets.length * 0.0000225;

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              IT Support Router
            </h1>
            <p className="text-gray-500 mt-2">Welcome back, <span className="font-semibold">{session.user?.name}</span>.</p>
          </div>
          <button 
            onClick={() => signOut()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Submission Form */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Submit New Ticket</h2>
              <form onSubmit={submitTicket} className="space-y-4">
                <div>
                  <input
                    type="text"
                    placeholder="Ticket Subject"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <textarea
                    placeholder="Describe the technical issue in detail..."
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send size={16} />
                  {isSubmitting ? "Routing..." : "Route Ticket"}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Metrics & Feed */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <MetricCard title="Total Tickets" value={tickets.length.toString()} icon={<Activity className="text-blue-500" />} />
              <MetricCard title="Routed by ML" value={mlTickets.length.toString()} icon={<BrainCircuit className="text-green-500" />} />
              <MetricCard title="LLM Fallbacks" value={(tickets.length - mlTickets.length).toString()} icon={<ShieldAlert className="text-amber-500" />} />
              <MetricCard title="Cloud Cost Avoided" value={`$${cloudCostAvoided.toFixed(5)}`} icon={<Wallet className="text-purple-500" />} />
            </div>

            {/* Feed */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">Recent Transactions</h3>
              </div>
              <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{ticket.subject}</p>
                      <p className="text-xs text-gray-500 mt-1">Routed to: <span className="font-semibold text-gray-700">{ticket.assigned_queue}</span></p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${ticket.engine.includes("ML") ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {ticket.engine.split(' ')[0]}
                      </span>
                      <p className="text-xs text-gray-400 mt-2">{ticket.latency_ms} ms</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
      <div className="p-3 bg-gray-50 rounded-lg">{icon}</div>
      <div>
        <p className="text-xs font-medium text-gray-500">{title}</p>
        <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}