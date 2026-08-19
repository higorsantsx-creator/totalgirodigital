import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, Phone, Download, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

type Client = {
  id: string;
  name: string;
  company: string | null;
  role: string | null;
  unit: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  access_code: string | null;
  facial_status: string | null;
};



function ClientsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [selectedFacial, setSelectedFacial] = useState("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, role, unit, document, email, phone, notes, access_code, facial_status")
        .order("name");
      if (error) throw error;
      return data as unknown as Client[];

    },

  });

  const units = Array.from(new Set((clients ?? []).map(c => c.unit).filter(Boolean))).sort() as string[];

  const list = (clients ?? []).filter((c) => {
    const matchesUnit = selectedUnit === "all" || c.unit === selectedUnit;
    if (!matchesUnit) return false;

    const matchesFacial = selectedFacial === "all" || c.facial_status === selectedFacial;
    if (!matchesFacial) return false;

    if (!q) return true;

    const s = q.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.company ?? "").toLowerCase().includes(s) ||
      (c.phone ?? "").toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s) ||
      (c.unit ?? "").toLowerCase().includes(s) ||
      (c.role ?? "").toLowerCase().includes(s)
    );
  });

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (c: Client) => {
    setEditing(c);
    setOpen(true);
  };

  const exportToPDF = () => {
    if (list.length === 0) return toast.error("Nenhum dado para exportar");
    
    const doc = new jsPDF();
    const tableColumn = ["Nome", "Empresa", "Cargo", "Unidade", "WhatsApp", "CPF/CNPJ"];
    const tableRows = list.map(c => [
      c.name,
      c.company ?? "—",
      c.role ?? "—",
      c.unit ?? "—",
      c.phone ?? "—",
      c.document ?? "—"
    ]);

    doc.setFontSize(18);
    doc.text("Relatório de Funcionários", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      styles: { fontSize: 9 }
    });

    doc.save("funcionarios.pdf");
    toast.success("PDF gerado com sucesso");
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este funcionário?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Funcionário excluído");
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  const save = async (form: FormData) => {
    if (!user) return;
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      company: (String(form.get("company") ?? "").trim() || null),
      role: (String(form.get("role") ?? "").trim() || null),
      unit: (String(form.get("unit") ?? "").trim() || null),
      document: (String(form.get("document") ?? "").trim() || null),
      email: (String(form.get("email") ?? "").trim() || null),
      phone: (String(form.get("phone") ?? "").trim() || null),
      notes: (String(form.get("notes") ?? "").trim() || null),
      access_code: (String(form.get("access_code") ?? "").trim() || null),
    };

    if (!payload.name) return toast.error("Nome é obrigatório");

    if (editing) {
      const { error } = await supabase.from("clients").update(payload as any).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Funcionário atualizado");
    } else {
      const { error } = await supabase.from("clients").insert({ ...payload, owner_id: user.id } as any);
      if (error) return toast.error(error.message);
      toast.success("Funcionário cadastrado");
    }
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["clients"] });
  };

  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/80 px-8 backdrop-blur-sm">
        <h1 className="font-display text-lg font-semibold">Funcionários</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2 border-r border-border pr-4">
            <Label htmlFor="facial-filter" className="hidden text-xs font-medium text-muted-foreground sm:block">
              Biometria:
            </Label>
            <select
              id="facial-filter"
              value={selectedFacial}
              onChange={(e) => setSelectedFacial(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-40"
            >
              <option value="all">Todos</option>
              <option value="registered">Cadastrada</option>
              <option value="pending">Pendente</option>
            </select>
          </div>
          <Button
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              exportToPDF();
            }}
            disabled={isLoading || list.length === 0}
            className="bg-white hover:bg-slate-50 border-slate-200 text-slate-600 font-medium relative z-50"
          >
            <Download className="mr-2 size-4 text-slate-400" /> Exportar PDF
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="bg-[#E30613] hover:bg-[#C20510] text-white font-semibold">
                <Plus className="mr-2 size-4" /> Novo funcionário
              </Button>
            </DialogTrigger>

            <DialogContent className="z-[100]">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save(new FormData(e.currentTarget));
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="name">Nome *</Label>
                    <Input id="name" name="name" required defaultValue={editing?.name ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">WhatsApp *</Label>
                    <Input id="phone" name="phone" placeholder="(11) 99999-9999" defaultValue={editing?.phone ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="access_code">Código Único (Acesso)</Label>
                    <Input id="access_code" name="access_code" placeholder="Gerado automaticamente se vazio" defaultValue={editing?.access_code ?? ""} />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="company">Empresa</Label>
                    <Input id="company" name="company" defaultValue={editing?.company ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="role">Cargo</Label>
                    <Input id="role" name="role" placeholder="Ex.: Motorista, Analista" defaultValue={editing?.role ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="unit">Unidade/Categoria</Label>
                    <Input id="unit" name="unit" placeholder="Ex.: Matriz, Setor A" defaultValue={editing?.unit ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="document">CPF/CNPJ</Label>
                    <Input id="document" name="document" defaultValue={editing?.document ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea id="notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editing ? "Salvar" : "Cadastrar"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>


      <div className="mx-auto max-w-7xl space-y-6 p-8">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, cargo, unidade..."
                className="w-full pl-9 sm:w-80"
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="unit-filter" className="hidden text-xs font-medium text-muted-foreground sm:block">
                Filtrar por Unidade:
              </Label>
              <select
                id="unit-filter"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-48"
              >
                <option value="all">Todas as Unidades</option>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-secondary/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3">Código</th>
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Empresa</th>
                <th className="px-6 py-3">Cargo</th>
                <th className="px-6 py-3">Unidade</th>
                <th className="px-6 py-3">Biometria</th>
                <th className="px-6 py-3 text-right">Ações</th>

              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoading &&
                list.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-secondary/40">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-primary">{c.access_code ?? "—"}</td>
                    <td className="px-6 py-4 font-medium">{c.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.company ?? "—"}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.role ?? "—"}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.unit ?? "—"}</td>
                    <td className="px-6 py-4">
                      {c.facial_status === "registered" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                          <CheckCircle2 className="size-3" /> Cadastrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                          <Clock className="size-3" /> Pendente
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-muted-foreground">{c.phone ?? "—"}</td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        title="Resetar biometria"
                        onClick={async () => {
                          if (!confirm("Tem certeza que deseja resetar a biometria facial deste funcionário? Ele precisará cadastrar novamente na próxima assinatura.")) return;
                          const { error } = await supabase
                            .from("clients")
                            .update({ facial_status: "pending", facial_embedding: null, facial_registered_at: null })
                            .eq("id", c.id);
                          if (error) return toast.error(error.message);
                          toast.success("Biometria resetada");
                          qc.invalidateQueries({ queryKey: ["clients"] });
                        }}
                      >
                        <RotateCcw className="size-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>

                  </tr>
                ))}
              {!isLoading && list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                    Nenhum funcionário cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
