import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Bot, Pencil, Plus, Save, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import type { PublicSettings } from "@/lib/public-settings"
import { isPremiumEdition, withPublicSettingsDefaults } from "@/lib/public-settings"
import { useToast } from "@/components/ui/toast"

interface MCPServer {
  id: string
  name: string
  url: string
  headers: string
  enabled: boolean
  request_mode: "backend" | "frontend" | string
}

interface MCPDraft {
  id?: string
  name: string
  url: string
  headers: string
  enabled: boolean
}

interface AdvancedChatSettings {
  attachment_max_mb: number
  attachment_allowed_types: string[]
  builtin_mcp_servers: MCPServer[]
}

const defaultAdvancedChatSettings: AdvancedChatSettings = {
  attachment_max_mb: 10,
  attachment_allowed_types: ["text/plain", "text/markdown", "application/json", "text/csv", "image/png", "image/jpeg", "application/pdf"],
  builtin_mcp_servers: [],
}

const emptyDraft: MCPDraft = {
  name: "",
  url: "",
  headers: "",
  enabled: true,
}

export default function AdvancedChatManagement({ mode = "attachments" }: { mode?: "attachments" | "mcp" }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [form, setForm] = useState<AdvancedChatSettings>(defaultAdvancedChatSettings)
  const [typesText, setTypesText] = useState(defaultAdvancedChatSettings.attachment_allowed_types.join("\n"))
  const [draft, setDraft] = useState<MCPDraft>(emptyDraft)
  const [isServerDialogOpen, setIsServerDialogOpen] = useState(false)
  const [isBlockedOpen, setIsBlockedOpen] = useState(false)

  const { data: publicSettings } = useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await api.get("/public/settings")
      return res.data
    },
  })
  const settings = withPublicSettingsDefaults(publicSettings)
  const isPremium = isPremiumEdition(settings)

  const advancedSettings = useQuery<AdvancedChatSettings>({
    queryKey: ["advanced-chat-admin-settings"],
    enabled: isPremium,
    queryFn: async () => {
      const res = await api.get("/advanced-chat/settings")
      return normalizeAdvancedChatSettings(res.data)
    },
  })

  useEffect(() => {
    if (publicSettings && !isPremium) {
      setIsBlockedOpen(true)
    }
  }, [isPremium, publicSettings])

  useEffect(() => {
    if (!advancedSettings.data) {
      return
    }
    setForm(advancedSettings.data)
    setTypesText(advancedSettings.data.attachment_allowed_types.join("\n"))
  }, [advancedSettings.data])

  const allowedTypes = useMemo(() => parseAllowedTypes(typesText), [typesText])

  const saveAttachmentSettings = useMutation({
    mutationFn: async () => {
      if (!isPremium) {
        throw new Error("Advanced chat requires premium edition")
      }
      const res = await api.put("/advanced-chat/settings", {
        attachment_max_mb: Number(form.attachment_max_mb) || 10,
        attachment_allowed_types: allowedTypes,
      })
      return normalizeAdvancedChatSettings(res.data)
    },
    onSuccess: (saved) => {
      setForm(saved)
      setTypesText(saved.attachment_allowed_types.join("\n"))
      success("附件设置已保存")
      queryClient.invalidateQueries({ queryKey: ["advanced-chat-admin-settings"] })
      queryClient.invalidateQueries({ queryKey: ["advanced-chat-user-settings"] })
    },
    onError: (err) => error(err instanceof Error ? err.message : "保存附件设置失败"),
  })

  const saveMCPServers = useMutation({
    mutationFn: async (input: { servers: MCPServer[]; message: string; closeDialog?: boolean }) => {
      if (!isPremium) {
        throw new Error("Advanced chat requires premium edition")
      }
      const res = await api.put("/advanced-chat/settings", {
        builtin_mcp_servers: input.servers.map((server) => ({
          ...server,
          request_mode: "backend",
        })),
      })
      return { settings: normalizeAdvancedChatSettings(res.data), message: input.message, closeDialog: input.closeDialog }
    },
    onSuccess: ({ settings: saved, message, closeDialog }) => {
      setForm(saved)
      setTypesText(saved.attachment_allowed_types.join("\n"))
      if (closeDialog) {
        setIsServerDialogOpen(false)
      }
      success(message)
      queryClient.invalidateQueries({ queryKey: ["advanced-chat-admin-settings"] })
      queryClient.invalidateQueries({ queryKey: ["advanced-chat-user-settings"] })
    },
    onError: (err) => error(err instanceof Error ? err.message : "保存 MCP 服务器失败"),
  })

  const openCreateDialog = () => {
    setDraft(emptyDraft)
    setIsServerDialogOpen(true)
  }

  const openEditDialog = (server: MCPServer) => {
    setDraft({
      id: server.id,
      name: server.name,
      url: server.url,
      headers: server.headers || "",
      enabled: server.enabled,
    })
    setIsServerDialogOpen(true)
  }

  const applyDraft = () => {
    const next: MCPServer = {
      id: draft.id || createID(),
      name: draft.name.trim(),
      url: draft.url.trim(),
      headers: draft.headers.trim(),
      enabled: draft.enabled,
      request_mode: "backend",
    }
    if (!next.name || !next.url) {
      error("请输入 MCP 名称和服务器地址")
      return
    }
    const nextServers = draft.id
      ? form.builtin_mcp_servers.map((server) => (server.id === draft.id ? next : server))
      : [...form.builtin_mcp_servers, next]
    saveMCPServers.mutate({
      servers: nextServers,
      message: draft.id ? "MCP 服务器已更新" : "MCP 服务器已添加",
      closeDialog: true,
    })
  }

  const removeServer = (id: string) => {
    saveMCPServers.mutate({
      servers: form.builtin_mcp_servers.filter((server) => server.id !== id),
      message: "MCP 服务器已删除",
    })
  }

  const leaveBlockedPage = () => navigate("/dashboard", { replace: true })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">高级聊天管理</h1>
          <div className="mt-2 text-sm text-muted-foreground">管理独立聊天的附件限制和内置 MCP 服务器。</div>
        </div>
      </div>

      {isPremium && (
        <>
          {mode === "attachments" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>附件设置</CardTitle>
                  <Button className="gap-2" disabled={saveAttachmentSettings.isPending} onClick={() => saveAttachmentSettings.mutate()}>
                    <Save size={16} />
                    {saveAttachmentSettings.isPending ? "保存中" : "保存"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">单个附件大小上限 MB</span>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.attachment_max_mb}
                    onChange={(event) => setForm((current) => ({ ...current, attachment_max_mb: Number(event.target.value) || 1 }))}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium">允许的附件类型</span>
                  <textarea
                    className="min-h-32 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value={typesText}
                    placeholder="text/plain&#10;application/json&#10;image/png"
                    onChange={(event) => setTypesText(event.target.value)}
                  />
                  <span className="block text-xs text-muted-foreground">每行一个 MIME 类型，支持 `text/*` 这样的通配。</span>
                </label>
              </CardContent>
            </Card>
          )}

          {mode === "mcp" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>内置 MCP 服务器</CardTitle>
                  <Button variant="outline" className="gap-2" disabled={saveMCPServers.isPending} onClick={openCreateDialog}>
                    <Plus size={16} />
                    添加
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {form.builtin_mcp_servers.length === 0 ? (
                  <div className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">暂无内置 MCP 服务器</div>
                ) : (
                  form.builtin_mcp_servers.map((server) => (
                    <div key={server.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <Bot className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm font-medium">{server.name}</span>
                          <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">后端请求</span>
                          {!server.enabled && <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">停用</span>}
                        </div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">{server.url}</div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button variant="outline" size="icon" disabled={saveMCPServers.isPending} onClick={() => openEditDialog(server)} aria-label="编辑 MCP 服务器" title="编辑 MCP 服务器">
                          <Pencil size={16} />
                        </Button>
                        <Button variant="outline" size="icon" disabled={saveMCPServers.isPending} onClick={() => removeServer(server.id)} aria-label="删除 MCP 服务器" title="删除 MCP 服务器">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={isServerDialogOpen} onOpenChange={setIsServerDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "编辑内置 MCP" : "添加内置 MCP"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium">名称</span>
              <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">服务器地址</span>
              <Input value={draft.url} placeholder="https://mcp.example.com" onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">请求头 JSON</span>
              <textarea
                className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={draft.headers}
                placeholder='{"Authorization":"Bearer ..."}'
                onChange={(event) => setDraft((current) => ({ ...current, headers: event.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} />
              启用
            </label>
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">管理员内置 MCP 服务器由后端请求。</div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsServerDialogOpen(false)}>
              取消
            </Button>
            <Button disabled={saveMCPServers.isPending} onClick={applyDraft}>
              {saveMCPServers.isPending ? "保存中" : "确定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBlockedOpen} onOpenChange={(open) => (!open ? leaveBlockedPage() : setIsBlockedOpen(open))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>需要高级版</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">高级聊天管理属于高级版功能，当前版本不可用。</div>
          <DialogFooter>
            <Button onClick={leaveBlockedPage}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function normalizeAdvancedChatSettings(value: unknown): AdvancedChatSettings {
  const item = isRecord(value) ? value : {}
  return {
    attachment_max_mb: Number(item.attachment_max_mb || defaultAdvancedChatSettings.attachment_max_mb),
    attachment_allowed_types: Array.isArray(item.attachment_allowed_types)
      ? item.attachment_allowed_types.filter((value): value is string => typeof value === "string")
      : defaultAdvancedChatSettings.attachment_allowed_types,
    builtin_mcp_servers: Array.isArray(item.builtin_mcp_servers) ? item.builtin_mcp_servers.map(normalizeMCPServer) : [],
  }
}

function normalizeMCPServer(value: unknown): MCPServer {
  const item = isRecord(value) ? value : {}
  return {
    id: typeof item.id === "string" && item.id ? item.id : createID(),
    name: typeof item.name === "string" ? item.name : "",
    url: typeof item.url === "string" ? item.url : "",
    headers: typeof item.headers === "string" ? item.headers : "",
    enabled: item.enabled !== false,
    request_mode: typeof item.request_mode === "string" ? item.request_mode : "backend",
  }
}

function parseAllowedTypes(raw: string) {
  return raw
    .split(/\r?\n|,/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

function createID() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
