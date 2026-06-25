import { useEffect, useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, Laptop, Plus, RefreshCcw, Save, Terminal, Trash2 } from "lucide-react"
import api from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface ConnectorDevice {
  id: string
  name: string
  remark?: string
  hostname?: string
  os?: string
  arch?: string
  version?: string
  status: string
  online: boolean
  last_seen_at?: string
  created_at?: string
}

const devicesQueryKey = ["advanced-chat-connector-devices"] as const

export default function AdvancedChatDevices() {
  const { language } = useI18n()
  const copy = language === "zh" ? zhCopy : language === "ja" ? jaCopy : enCopy
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [deviceName, setDeviceName] = useState(copy.defaultDeviceName)
  const [deviceRemark, setDeviceRemark] = useState("")
  const [baseURL, setBaseURL] = useState(() => (typeof window !== "undefined" ? window.location.origin : "http://localhost:8080"))
  const [token, setToken] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [remarkDrafts, setRemarkDrafts] = useState<Record<string, string>>({})
  const [savingDeviceID, setSavingDeviceID] = useState("")
  const [deletingDeviceID, setDeletingDeviceID] = useState("")

  const { data: devices = [], isFetching, refetch } = useQuery<ConnectorDevice[]>({
    queryKey: devicesQueryKey,
    refetchInterval: 5000,
    queryFn: async () => {
      const res = await api.get("/user/advanced-chat/devices")
      return Array.isArray(res.data) ? res.data.map(normalizeDevice).filter((device): device is ConnectorDevice => Boolean(device)) : []
    },
  })

  useEffect(() => {
    setDeviceName(copy.defaultDeviceName)
  }, [copy.defaultDeviceName])

  useEffect(() => {
    setRemarkDrafts((current) => {
      const next = { ...current }
      for (const device of devices) {
        if (!(device.id in next)) {
          next[device.id] = device.remark || ""
        }
      }
      return next
    })
  }, [devices])

  const commands = useMemo(() => {
    if (!token) {
      return { windows: "", unix: "" }
    }
    const server = quoteArg(baseURL.trim() || "http://localhost:8080")
    const rawToken = quoteArg(token)
    return {
      windows: `app.exe -server ${server} -token ${rawToken}`,
      unix: `./app -server ${server} -token ${rawToken}`,
    }
  }, [baseURL, token])

  const createToken = async () => {
    const name = deviceName.trim() || copy.defaultDeviceName
    setIsCreating(true)
    try {
      const res = await api.post("/user/advanced-chat/devices/token", {
        name,
        remark: deviceRemark.trim(),
      })
      const nextToken = typeof res.data?.token === "string" ? res.data.token : ""
      if (!nextToken) {
        throw new Error(copy.createFailed)
      }
      setToken(nextToken)
      setDeviceRemark("")
      success(copy.created)
      await queryClient.invalidateQueries({ queryKey: devicesQueryKey })
    } catch (err) {
      error(apiErrorMessage(err, copy.createFailed))
    } finally {
      setIsCreating(false)
    }
  }

  const copyValue = async (value: string) => {
    if (!value) {
      return
    }
    await navigator.clipboard.writeText(value)
    success(copy.copied)
  }

  const saveRemark = async (device: ConnectorDevice) => {
    setSavingDeviceID(device.id)
    try {
      await api.put(`/user/advanced-chat/devices/${encodeURIComponent(device.id)}`, {
        remark: remarkDrafts[device.id] || "",
      })
      success(copy.saved)
      await queryClient.invalidateQueries({ queryKey: devicesQueryKey })
    } catch (err) {
      error(apiErrorMessage(err, copy.saveFailed))
    } finally {
      setSavingDeviceID("")
    }
  }

  const deleteDevice = async (device: ConnectorDevice) => {
    if (!window.confirm(copy.deleteConfirm.replace("{name}", device.name))) {
      return
    }
    setDeletingDeviceID(device.id)
    try {
      await api.delete(`/user/advanced-chat/devices/${encodeURIComponent(device.id)}`)
      success(copy.deleted)
      await queryClient.invalidateQueries({ queryKey: devicesQueryKey })
    } catch (err) {
      error(apiErrorMessage(err, copy.deleteFailed))
    } finally {
      setDeletingDeviceID("")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{copy.title}</h1>
          <div className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</div>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCcw size={16} />
          {copy.refresh}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal size={18} />
            {copy.commandTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="space-y-1 text-sm">
              <span className="font-medium">{copy.deviceName}</span>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">{copy.remark}</span>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={deviceRemark}
                placeholder={copy.remarkPlaceholder}
                onChange={(event) => setDeviceRemark(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Base URL</span>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={baseURL}
                onChange={(event) => setBaseURL(event.target.value)}
              />
            </label>
            <div className="flex items-end">
              <Button className="w-full gap-2" onClick={createToken} disabled={isCreating}>
                <Plus size={16} />
                {isCreating ? copy.creating : copy.generateCommand}
              </Button>
            </div>
          </div>

          {token && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
              <CommandRow label={copy.token} value={token} copyText={copy.copy} onCopy={copyValue} />
              <CommandRow label={copy.windowsCommand} value={commands.windows} copyText={copy.copy} onCopy={copyValue} />
              <CommandRow label={copy.unixCommand} value={commands.unix} copyText={copy.copy} onCopy={copyValue} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Laptop size={18} />
            {copy.deviceList}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{copy.empty}</div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div key={device.id} className="rounded-md border p-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-sm font-medium">{device.name}</div>
                        <span className={cn("shrink-0 text-xs", device.online ? "text-emerald-600" : "text-muted-foreground")}>
                          {device.online ? copy.online : copy.offline}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {[device.hostname, device.os, device.arch, device.version].filter(Boolean).join(" / ") || "-"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{copy.lastSeen}: {formatDateTime(device.last_seen_at) || "-"}</div>
                    </div>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">{copy.remark}</span>
                      <input
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={remarkDrafts[device.id] || ""}
                        placeholder={copy.remarkPlaceholder}
                        onChange={(event) => setRemarkDrafts((current) => ({ ...current, [device.id]: event.target.value }))}
                      />
                    </label>
                    <div className="flex gap-2 lg:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => saveRemark(device)}
                        disabled={savingDeviceID === device.id}
                      >
                        <Save size={15} />
                        {copy.save}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-destructive hover:text-destructive"
                        onClick={() => deleteDevice(device)}
                        disabled={deletingDeviceID === device.id}
                      >
                        <Trash2 size={15} />
                        {copy.delete}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CommandRow({ label, value, copyText, onCopy }: { label: string; value: string; copyText: string; onCopy: (value: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto] sm:items-center">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="min-w-0 break-all rounded-md bg-background p-2 font-mono text-xs">{value}</div>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => onCopy(value)}>
        <Copy size={15} />
        {copyText}
      </Button>
    </div>
  )
}

function normalizeDevice(value: unknown): ConnectorDevice | null {
  if (!isRecord(value)) {
    return null
  }
  const id = stringFromUnknown(value.id)
  if (!id) {
    return null
  }
  return {
    id,
    name: stringFromUnknown(value.name) || "Local device",
    remark: stringFromUnknown(value.remark) || undefined,
    hostname: stringFromUnknown(value.hostname) || undefined,
    os: stringFromUnknown(value.os) || undefined,
    arch: stringFromUnknown(value.arch) || undefined,
    version: stringFromUnknown(value.version) || undefined,
    status: stringFromUnknown(value.status) || "offline",
    online: value.online === true,
    last_seen_at: stringFromUnknown(value.last_seen_at) || undefined,
    created_at: stringFromUnknown(value.created_at) || undefined,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function stringFromUnknown(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function quoteArg(value: string) {
  if (!/[ \t"]/g.test(value)) {
    return value
  }
  return `"${value.replace(/"/g, '\\"')}"`
}

function formatDateTime(value?: string) {
  if (!value) {
    return ""
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function apiErrorMessage(err: unknown, fallback: string) {
  if (isRecord(err) && isRecord(err.response) && isRecord(err.response.data) && typeof err.response.data.error === "string") {
    return err.response.data.error
  }
  return err instanceof Error ? err.message : fallback
}

const zhCopy = {
  title: "设备",
  subtitle: "管理连接到高级聊天的本地设备，并生成本地连接器启动命令。",
  commandTitle: "添加设备",
  deviceName: "设备名称",
  defaultDeviceName: "本地设备",
  remark: "备注",
  remarkPlaceholder: "例如办公电脑、家里主机",
  generateCommand: "生成连接命令",
  creating: "生成中...",
  token: "令牌",
  windowsCommand: "Windows",
  unixCommand: "macOS / Linux",
  copy: "复制",
  copied: "已复制",
  created: "连接命令已生成",
  createFailed: "生成连接命令失败",
  deviceList: "设备列表",
  empty: "暂无设备，先生成命令并启动 app 连接器。",
  refresh: "刷新",
  online: "在线",
  offline: "离线",
  lastSeen: "最后在线",
  save: "保存备注",
  saved: "备注已保存",
  saveFailed: "保存备注失败",
  delete: "删除",
  deleted: "设备已删除",
  deleteFailed: "删除设备失败",
  deleteConfirm: "确定删除设备 {name}？",
}

const enCopy: typeof zhCopy = {
  title: "Devices",
  subtitle: "Manage local devices connected to advanced chat and generate connector start commands.",
  commandTitle: "Add device",
  deviceName: "Device name",
  defaultDeviceName: "Local device",
  remark: "Remark",
  remarkPlaceholder: "For example work laptop or home PC",
  generateCommand: "Generate command",
  creating: "Generating...",
  token: "Token",
  windowsCommand: "Windows",
  unixCommand: "macOS / Linux",
  copy: "Copy",
  copied: "Copied",
  created: "Connector command generated",
  createFailed: "Failed to generate connector command",
  deviceList: "Device list",
  empty: "No devices yet. Generate a command and start the app connector first.",
  refresh: "Refresh",
  online: "Online",
  offline: "Offline",
  lastSeen: "Last seen",
  save: "Save remark",
  saved: "Remark saved",
  saveFailed: "Failed to save remark",
  delete: "Delete",
  deleted: "Device deleted",
  deleteFailed: "Failed to delete device",
  deleteConfirm: "Delete device {name}?",
}

const jaCopy: typeof zhCopy = {
  ...enCopy,
  title: "デバイス",
  subtitle: "高度なチャットに接続するローカルデバイスを管理し、コネクター起動コマンドを生成します。",
  commandTitle: "デバイスを追加",
  deviceName: "デバイス名",
  defaultDeviceName: "ローカルデバイス",
  remark: "メモ",
  generateCommand: "コマンドを生成",
  deviceList: "デバイス一覧",
  empty: "デバイスがありません。先にコマンドを生成して app コネクターを起動してください。",
}
