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
import { Plus, Search, Pencil, Trash2, Phone } from "lucide-react";
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
};

function ClientsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company, role, unit, document, email, phone, notes")
        .order("name");
      if (error) throw error;
      return data as Client[];
    },
  });

  const list = (clients ?? []).filter((c) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.company ?? "").toLowerCase().includes(s) ||
      (c.phone ?? "").toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s)
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
    };
    if (!payload.name) return toast.error("Nome é obrigatório");

    if (editing) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Funcionário atualizado");
    } else {
      const { error } = await supabase.from("clients").insert({ ...payload, owner_id: user.id });
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-1.5 size-4" /> Novo funcionário
            </Button>
          </DialogTrigger>
          <DialogContent>
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
      </header>

      <div className="mx-auto max-w-7xl space-y-6 p-8">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome, empresa, telefone..."
                className="w-80 pl-9"
              />
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-secondary/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">Empresa</th>
                <th className="px-6 py-3">Cargo</th>
                <th className="px-6 py-3">Unidade</th>
                <th className="px-6 py-3">WhatsApp</th>
                <th className="px-6 py-3">CPF/CNPJ</th>
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
                    <td className="px-6 py-4 font-medium">{c.name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.company ?? "—"}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.role ?? "—"}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.unit ?? "—"}</td>
                    <td className="px-6 py-4">
                      {c.phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="size-3.5 text-success" /> {c.phone}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{c.document ?? "—"}</td>
                    <td className="px-6 py-4 text-right">
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
