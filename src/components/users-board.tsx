"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserCreateSheet } from "@/components/user-create-sheet";
import { deleteUser, updateUserRole } from "@/app/actions/users";
import { ROLE_LABELS, type AppUser, type UserRole } from "@/types/users";

function initialsOf(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export function UsersBoard({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AppUser[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [, startTransition] = useTransition();

  function handleRoleChange(user: AppUser, role: UserRole) {
    const prevRole = user.role;
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role } : u)));
    startTransition(async () => {
      const result = await updateUserRole(user.id, role);
      if (result.error) {
        toast.error(result.error);
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role: prevRole } : u)),
        );
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      const result = await deleteUser(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success("Usuário excluído.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <UserCreateSheet onCreated={(user) => setUsers((prev) => [...prev, user])} />
      </div>

      <div className="insyt-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--insyt-border)] hover:bg-transparent">
              <TableHead className="pl-6">Usuário</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead className="w-10 pr-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow
                key={u.id}
                className="group border-[var(--insyt-border)] transition-colors hover:bg-[var(--insyt-canvas-alt)]/50"
              >
                <TableCell className="py-4 pl-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--insyt-canvas-alt)] text-[11px] font-bold text-[var(--insyt-primary)]">
                      {initialsOf(u.email)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--insyt-black)]">
                        {u.email}
                      </p>
                      {u.id === currentUserId ? (
                        <p className="text-xs text-[var(--insyt-muted)]">Você</p>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <Select
                    value={u.role}
                    onValueChange={(v) => {
                      if (v) handleRoleChange(u, v as UserRole);
                    }}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue>
                        {(value: UserRole | null) => (
                          <Badge
                            className={
                              (value ?? u.role) === "admin"
                                ? "bg-[#fff4f0] font-semibold text-[var(--insyt-primary-dark)]"
                                : "bg-slate-50 text-slate-600"
                            }
                          >
                            {ROLE_LABELS[value ?? u.role]}
                          </Badge>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Membro</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-4 text-[var(--insyt-muted)]">
                  {format(new Date(u.created_at), "d MMM yyyy", { locale: ptBR })}
                </TableCell>
                <TableCell className="py-4 text-[var(--insyt-muted)]">
                  {u.last_sign_in_at
                    ? format(new Date(u.last_sign_in_at), "d MMM yyyy", { locale: ptBR })
                    : "Nunca"}
                </TableCell>
                <TableCell className="py-4 pr-6">
                  {u.id === currentUserId ? null : (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button type="button" variant="ghost" size="icon-sm">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(u)}
                        >
                          <Trash2 className="size-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.email} perde o acesso ao sistema imediatamente. Essa ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
