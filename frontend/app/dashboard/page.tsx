"use client";

import { Activity, BrainCircuit, ShieldAlert, Wallet, LogOut, Send, CheckCircle, ChevronLeft, ChevronRight, UserPlus, RefreshCw, AlertTriangle } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface TicketLog {
  id: number;
  subject: string;
  body: string;
  engine: string;
  assigned_queue: string;
  confidence_score: number;
  latency_ms: number;
  status: string;
  is_reassigned: boolean;
  corrected_queue: string | null;
  cost_usd: number;
  tokens_used: number;
  llm_used: boolean;
}

const ROLE_OPTIONS = [
  { label: "Standard User", value: "user" },
  { label: "Billing & Finance Agent", value: "Billing & Finance" },
  { label: "Customer Ops & Sales Agent", value: "Customer Ops & Sales" },
  { label: "Internal & HR Agent", value: "Internal & HR" },
  { label: "Outages & Infrastructure Agent", value: "Outages & Infrastructure" },
  { label: "Tech & IT Support Agent", value: "Tech & IT Support" },
];

const QUEUES = [
  "Billing & Finance",
  "Customer Ops & Sales",
  "Internal & HR",
  "Outages & Infrastructure",
  "Tech & IT Support"
];

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // App State
  const [tickets, setTickets] = useState<TicketLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalTickets, setTotalTickets] = useState(0);
  const limit = 5; 

  // Ticket Submission State (Standard Users)
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin State
  const [activeTab, setActiveTab] = useState<"feed" | "users">("feed");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState(ROLE_OPTIONS[0].value);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRetraining, setIsRetraining] = useState(false);
  const [usersList, setUsersList] = useState<{ id: number; username: string; role: string }[]>([]);

  // Security kick-out
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchTickets = useCallback(async () => {
    if (!session) return;
    try {
      const skip = (page - 1) * limit;
      const res = await fetch(`http://localhost:8000/api/v1/tickets/logs?skip=${skip}&limit=${limit}`, {
        headers: {
          "Authorization": `Bearer ${(session as any)?.accessToken}`
        }
      });
      
      if (res.status === 401) return signOut();

      if (res.ok) {
        const data = await res.json();
        setTickets(data.items);
        setTotalTickets(data.total);
      }
    } catch (error) {
      console.error("Failed to fetch tickets", error);
    }
  }, [session, page, limit]);

  const fetchUsers = useCallback(async () => {
    if (!session || (session as any)?.role !== "admin") return;
    try {
      const res = await fetch("http://localhost:8000/api/v1/auth/users", {
        headers: {
          "Authorization": `Bearer ${(session as any)?.accessToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  }, [session]);

  useEffect(() => {
    if (status === "authenticated") fetchTickets();
  }, [status, fetchTickets]);

  useEffect(() => {
    if (status === "authenticated" && activeTab === "users") {
      fetchUsers();
    }
  }, [status, activeTab, fetchUsers]);

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !body) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/tickets/route", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${(session as any)?.accessToken}`
        },
        body: JSON.stringify({ subject, body }),
      });
      if (res.status === 401) return signOut();
      setSubject("");
      setBody("");
      setPage(1);
      fetchTickets();
    } catch (error) {
      console.error("Error submitting ticket", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolveTicket = async (ticketId: number) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${(session as any)?.accessToken}`
        },
        body: JSON.stringify({ status: "resolved" }),
      });
      if (res.status === 401) return signOut();
      fetchTickets(); 
    } catch (error) {
      console.error("Error resolving ticket", error);
    }
  };

  const reassignTicket = async (ticketId: number, correctedQueue: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/v1/tickets/${ticketId}/reassign`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${(session as any)?.accessToken}`
        },
        body: JSON.stringify({ corrected_queue: correctedQueue }),
      });
      if (res.status === 401) return signOut();
      fetchTickets(); 
    } catch (error) {
      console.error("Error reassigning ticket", error);
    }
  };

  const registerUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/auth/admin/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${(session as any)?.accessToken}`
        },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });
      if (res.status === 401) return signOut();
      if (res.ok) {
        alert(`Successfully registered ${newRole} account: ${newUsername}`);
        setNewUsername("");
        setNewPassword("");
        fetchUsers(); // Refresh the list instantly
      } else {
        const err = await res.json();
        alert(`Registration failed: ${err.detail}`);
      }
    } catch (error) {
      console.error("Registration error", error);
    } finally {
      setIsRegistering(false);
    }
  };

  const triggerRetraining = async () => {
    setIsRetraining(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/retrain", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${(session as any)?.accessToken}`
        }
      });
      if (res.status === 401) return signOut();
      alert("Active Learning Retraining has started in the background!");
    } catch (error) {
      console.error("Error triggering retraining", error);
    } finally {
      setIsRetraining(false);
    }
  };

  if (status === "loading") return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;
  if (!session) return null;

  // Role-Based UI Flags
  const role = (session as any)?.role || "user";
  const isAdmin = role === "admin";
  const isStandardUser = role === "user";
  const isAgent = !isAdmin && !isStandardUser;
  
  const totalPages = Math.ceil(totalTickets / limit);

  // --- FINOPS METRICS CALCULATIONS ---
  const totalSpent = tickets.reduce((acc, t) => acc + (t.cost_usd || 0), 0);
  const totalMlTickets = tickets.filter(t => !t.llm_used).length;
  const mlRate = tickets.length > 0 ? ((totalMlTickets / tickets.length) * 100).toFixed(0) : "0";
  const avgLatency = tickets.length > 0 
    ? (tickets.reduce((acc, t) => acc + (t.latency_ms || 0), 0) / tickets.length).toFixed(0) 
    : "0";
  
  // Estimate: Assuming LLM costs ~$0.002 per ticket if 100% went to LLM
  const estimatedUnoptimizedCost = tickets.length * 0.002;
  const costSaved = Math.max(0, estimatedUnoptimizedCost - totalSpent).toFixed(4);

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              IT Support Router
            </h1>
            <p className="text-gray-500 mt-2 flex items-center gap-2">
              Logged in as <span className="font-semibold text-gray-900">{session.user?.name}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full font-bold uppercase tracking-wider ${
                isAdmin ? 'bg-purple-100 text-purple-700' : 
                isAgent ? 'bg-blue-100 text-blue-700' : 
                'bg-gray-100 text-gray-600'
              }`}>
                {role}
              </span>
            </p>
          </div>
          <button 
            onClick={() => signOut()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>

        {/* KPI Cost & Efficiency Stats Bar - ADMIN ONLY */}
        {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total LLM Cost</p>
                <p className="text-2xl font-extrabold text-gray-900 mt-1">${totalSpent.toFixed(5)}</p>
              </div>
              <div className="p-3 bg-red-50 text-red-600 rounded-lg"><Wallet size={22} /></div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Estimated Savings</p>
                <p className="text-2xl font-extrabold text-green-600 mt-1">${costSaved}</p>
              </div>
              <div className="p-3 bg-green-50 text-green-600 rounded-lg"><BrainCircuit size={22} /></div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ML Autopilot Rate</p>
                <p className="text-2xl font-extrabold text-blue-600 mt-1">{mlRate}%</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Activity size={22} /></div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Response Time</p>
                <p className="text-2xl font-extrabold text-purple-600 mt-1">{avgLatency} ms</p>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><ShieldAlert size={22} /></div>
            </div>
          </div>
        )}

        {/* Admin Navigation Tabs */}
        {isAdmin && (
          <div className="flex justify-between items-center border-b border-gray-200 pb-4">
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveTab("feed")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'feed' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                Global Ticket Feed
              </button>
              <button 
                onClick={() => setActiveTab("users")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'users' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
              >
                Manage Users & Agents
              </button>
            </div>
            <button 
              onClick={triggerRetraining}
              disabled={isRetraining}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-green-700 bg-green-100 border border-green-200 rounded-md hover:bg-green-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isRetraining ? "animate-spin" : ""} />
              {isRetraining ? "Retraining..." : "Retrain AI Router"}
            </button>
          </div>
        )}

        <div className={`grid grid-cols-1 ${isStandardUser ? 'lg:grid-cols-3' : ''} gap-8`}>
          
          {/* USER VIEW: Ticket Submission Form */}
          {isStandardUser && (
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-8">
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
          )}

          {/* ADMIN VIEW: User Management Form & Live Table */}
          {isAdmin && activeTab === "users" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full">
              
              {/* User Creation Form */}
              <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><UserPlus size={20} /></div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Register Account</h2>
                    <p className="text-xs text-gray-500">Create new users directly from UI.</p>
                  </div>
                </div>
                
                <form onSubmit={registerUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Username</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-sm"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-sm"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Account Role</label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 bg-white text-sm"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                    >
                      {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 mt-2"
                  >
                    {isRegistering ? "Creating..." : "Create Account"}
                  </button>
                </form>
              </div>

              {/* Live Users Directory Table */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                    Registered Accounts Directory
                  </h3>
                  <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2.5 py-1 rounded-full">
                    Total: {usersList.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-400 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3 font-semibold">ID</th>
                        <th className="px-6 py-3 font-semibold">Username</th>
                        <th className="px-6 py-3 font-semibold">Assigned Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {usersList.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-mono text-xs text-gray-400">#{u.id}</td>
                          <td className="px-6 py-4 font-bold text-gray-900">{u.username}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${
                              u.role === 'admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              u.role === 'user' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {usersList.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                            No users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* SHARED VIEW: Ticket Feed */}
          {((isAdmin && activeTab === "feed") || isStandardUser || isAgent) && (
            <div className={isStandardUser ? "lg:col-span-2" : "w-full"}>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                    {isAdmin ? "Global Organization Feed" : isAgent ? `${role} Feed` : "Your Submitted Tickets"}
                  </h3>
                  <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-1 rounded-full">Total: {totalTickets}</span>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {tickets.map((ticket) => (
                    <div key={ticket.id} className={`px-6 py-5 flex items-start justify-between hover:bg-gray-50 transition-colors ${ticket.is_reassigned ? 'bg-orange-50/30' : ''}`}>
                      <div className="flex-1 pr-6">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-base font-bold text-gray-900">{ticket.subject}</p>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                            ticket.status === 'resolved' ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {ticket.status}
                          </span>
                          {ticket.is_reassigned && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-orange-700 bg-orange-100 border border-orange-200">
                              <AlertTriangle size={10} /> HITL Corrected
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{ticket.body}</p>
                        
                        <div className="flex gap-4 mt-3 text-xs text-gray-500">
                          <p>Original Route: <span className={ticket.is_reassigned ? "line-through text-red-400" : "font-semibold text-gray-700"}>{ticket.assigned_queue}</span></p>
                          {ticket.is_reassigned && (
                            <p>Corrected Route: <span className="font-bold text-green-600">{ticket.corrected_queue}</span></p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-3 shrink-0">
                        {/* ENGINE TAG */}
                        <span className={`px-3 py-1 rounded-md text-xs font-bold border ${ticket.engine.includes("ML") ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                          {ticket.engine.split(' ')[0]} Engine
                        </span>

                        {/* COST & LATENCY MICRO-BADGES - ADMIN ONLY */}
                        {isAdmin && (
                          <div className="flex items-center gap-2 text-[11px] font-medium text-gray-500 mt-1">
                            <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 font-mono">
                              ⚡ {ticket.latency_ms?.toFixed(0)}ms
                            </span>
                            <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                              ticket.cost_usd === 0 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                            }`}>
                              ${ticket.cost_usd ? ticket.cost_usd.toFixed(6) : "0.000000"}
                            </span>
                          </div>
                        )}
                        
                        {/* AGENT ACTIONS: Resolve OR Reassign */}
                        {isAgent && ticket.status !== 'resolved' && (
                          <div className="flex flex-col items-end gap-2 mt-2">
                            <button 
                              onClick={() => resolveTicket(ticket.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                            >
                              <CheckCircle size={14} /> Mark Resolved
                            </button>
                            
                            <select
                              className="text-xs border border-gray-300 rounded p-1.5 text-gray-600 bg-white hover:border-gray-400 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500"
                              value=""
                              onChange={(e) => reassignTicket(ticket.id, e.target.value)}
                            >
                              <option value="" disabled>Wrong queue? Reassign...</option>
                              {QUEUES.filter(q => q !== ticket.assigned_queue).map(q => (
                                <option key={q} value={q}>{q}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        {/* ADMIN ACTIONS: Only Resolve */}
                        {isAdmin && ticket.status !== 'resolved' && (
                           <button 
                            onClick={() => resolveTicket(ticket.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 mt-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                           >
                            <CheckCircle size={14} /> Force Resolve
                           </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {tickets.length === 0 && (
                    <div className="p-12 text-center flex flex-col items-center">
                      <div className="p-3 bg-gray-100 rounded-full mb-3 text-gray-400"><ShieldAlert size={24} /></div>
                      <p className="text-sm font-medium text-gray-900">No tickets found</p>
                      <p className="text-xs text-gray-500 mt-1">Queue is currently empty.</p>
                    </div>
                  )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                    <button 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
                    >
                      <ChevronLeft size={16} /> Prev
                    </button>
                    <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-md border border-gray-200">
                      Page {page} of {totalPages}
                    </span>
                    <button 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </main>
  );
}