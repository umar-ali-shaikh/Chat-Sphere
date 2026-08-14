import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/chat/avatar";
import { usersApi } from "@/api/users";
import { apiErrorMessage } from "@/lib/api-client";
import { initialsOf } from "@/types/api";
import { AUTH_ME_KEY } from "@/hooks/use-auth";

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileQuery = useQuery({
    queryKey: ["user", "profile"],
    queryFn: usersApi.getProfile,
    enabled: open,
  });

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (profileQuery.data) {
      setName(profileQuery.data.name);
      setBio(profileQuery.data.bio ?? "");
    }
  }, [profileQuery.data]);

  const profileMutation = useMutation({
    mutationFn: usersApi.updateProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(["user", "profile"], updated);
      queryClient.setQueryData(AUTH_ME_KEY, updated);
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Couldn't update profile.")),
  });

  const passwordMutation = useMutation({
    mutationFn: usersApi.changePassword,
    onSuccess: () => {
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Couldn't change password.")),
  });

  const avatarMutation = useMutation({
    mutationFn: usersApi.uploadAvatar,
    onSuccess: (updated) => {
      queryClient.setQueryData(["user", "profile"], updated);
      queryClient.setQueryData(AUTH_ME_KEY, updated);
      toast.success("Avatar updated");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Couldn't upload avatar.")),
  });

  const profile = profileQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Profile & settings</DialogTitle>
          <DialogDescription>Update how you appear to others and manage your account.</DialogDescription>
        </DialogHeader>

        {profileQuery.isLoading ? (
          <div className="grid place-items-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className="group relative"
                aria-label="Change avatar"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarMutation.isPending}
              >
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="size-16 rounded-2xl object-cover"
                  />
                ) : (
                  <Avatar initials={initialsOf(profile?.name ?? "?")} size="lg" />
                )}
                <span className="absolute inset-0 grid place-items-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  {avatarMutation.isPending ? (
                    <Loader2 className="size-5 animate-spin text-white" />
                  ) : (
                    <Camera className="size-5 text-white" />
                  )}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error("Avatar must be under 5MB.");
                    return;
                  }
                  avatarMutation.mutate(file);
                }}
              />
              <div>
                <p className="text-sm font-semibold">{profile?.name}</p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
              </div>
            </div>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                profileMutation.mutate({ name, bio });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="settings-name">Name</Label>
                <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-bio">Bio</Label>
                <Textarea id="settings-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={150} rows={2} />
              </div>
              <Button type="submit" size="sm" className="rounded-xl" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? "Saving…" : "Save profile"}
              </Button>
            </form>

            <form
              className="space-y-3 border-t border-border/60 pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!currentPassword || newPassword.length < 8) {
                  toast.error("Enter your current password and a new password (8+ characters).");
                  return;
                }
                passwordMutation.mutate({ currentPassword, newPassword });
              }}
            >
              <p className="text-sm font-medium">Change password</p>
              <div className="space-y-1.5">
                <Label htmlFor="settings-current-password">Current password</Label>
                <Input
                  id="settings-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-new-password">New password</Label>
                <Input
                  id="settings-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="text-xs text-muted-foreground">8+ chars, upper, lower, number, symbol</p>
              </div>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={passwordMutation.isPending}
              >
                {passwordMutation.isPending ? "Changing…" : "Change password"}
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
