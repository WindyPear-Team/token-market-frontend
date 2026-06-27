import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, Video, WandSparkles } from "lucide-react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageInlineSlot, PageTitleSlot } from "@/components/layout/PageTitleSlot"
import { useToast } from "@/components/ui/toast"
import { useI18n } from "@/lib/i18n"

interface UserChannelCatalog {
  id: number
  name: string
  models: string[]
}

interface VideoResult {
  url: string
  b64_json: string
  revised_prompt: string
  status: string
}

const modelStoreKey = "windypear.videos.model.v1"
const sizeStoreKey = "windypear.videos.size.v1"
const countStoreKey = "windypear.videos.count.v1"
const durationStoreKey = "windypear.videos.duration.v1"

const videoSizes = ["auto", "480p", "720p", "1080p", "1024x576", "576x1024", "1280x720", "720x1280", "1920x1080", "1080x1920"]

export default function Videos() {
  const { language } = useI18n()
  const copy = language === "zh" ? zhCopy : enCopy
  const { success, error, info } = useToast()
  const [apiKey, setAPIKey] = useState("")
  const [modelName, setModelName] = useState(() => localStorage.getItem(modelStoreKey) || "")
  const [prompt, setPrompt] = useState("")
  const [size, setSize] = useState(() => localStorage.getItem(sizeStoreKey) || "auto")
  const [count, setCount] = useState(() => normalizeCount(localStorage.getItem(countStoreKey) || "1"))
  const [duration, setDuration] = useState(() => normalizeDuration(localStorage.getItem(durationStoreKey) || "5"))
  const [results, setResults] = useState<VideoResult[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const { data: catalog = [] } = useQuery<UserChannelCatalog[]>({
    queryKey: ["catalog"],
    queryFn: async () => {
      const res = await api.get("/user/catalog")
      return Array.isArray(res.data) ? res.data.map(normalizeCatalogItem) : []
    },
  })

  const modelOptions = useMemo(() => uniqueModels(catalog), [catalog])

  useEffect(() => {
    if (!modelName && modelOptions.length > 0) {
      setModelName(modelOptions[0])
    }
  }, [modelName, modelOptions])

  useEffect(() => {
    if (modelName) {
      localStorage.setItem(modelStoreKey, modelName)
    }
  }, [modelName])

  useEffect(() => {
    localStorage.setItem(sizeStoreKey, size)
  }, [size])

  useEffect(() => {
    localStorage.setItem(countStoreKey, String(count))
  }, [count])

  useEffect(() => {
    localStorage.setItem(durationStoreKey, String(duration))
  }, [duration])

  const generateVideos = async () => {
    const rawKey = apiKey.trim()
    const cleanPrompt = prompt.trim()
    const cleanModel = modelName.trim()
    if (!rawKey) {
      error(copy.keyRequired)
      return
    }
    if (!cleanModel) {
      error(copy.modelRequired)
      return
    }
    if (!cleanPrompt) {
      error(copy.promptRequired)
      return
    }

    setIsGenerating(true)
    try {
      const body: Record<string, string | number> = {
        model: cleanModel,
        prompt: cleanPrompt,
        n: count,
        duration,
      }
      if (size !== "auto") {
        body.size = size
      }

      const response = await fetch("/v1/videos/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${rawKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
      const text = await response.text()
      const payload = parseJSON(text)
      if (!response.ok) {
        throw new Error(errorMessage(payload, text, response.status))
      }
      const nextResults = videoResultsFromPayload(payload)
      setResults(nextResults)
      if (nextResults.length > 0) {
        success(copy.generated.replace("{count}", String(nextResults.length)))
      } else {
        info(copy.emptyResponse)
      }
    } catch (err) {
      error(err instanceof Error ? err.message : copy.generateFailed)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">{copy.title}</h1>
        <Button className="gap-2" disabled={isGenerating || !prompt.trim()} onClick={generateVideos}>
          <WandSparkles size={16} />
          {isGenerating ? copy.generating : copy.generate}
        </Button>
      </div>

      <PageTitleSlot />
      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{copy.config}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-2 text-sm">
              <span className="font-medium">{copy.apiKey}</span>
              <Input value={apiKey} type="password" placeholder={copy.keyPlaceholder} onChange={(event) => setAPIKey(event.target.value)} />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-medium">{copy.model}</span>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={modelName} onChange={(event) => setModelName(event.target.value)}>
                <option value="">{copy.selectModel}</option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2 text-sm">
              <span className="font-medium">{copy.size}</span>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={size} onChange={(event) => setSize(event.target.value)}>
                {videoSizes.map((option) => (
                  <option key={option} value={option}>
                    {option === "auto" ? copy.auto : option}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2 text-sm">
                <span className="font-medium">{copy.count}</span>
                <Input min={1} max={4} type="number" value={count} onChange={(event) => setCount(normalizeCount(event.target.value))} />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="font-medium">{copy.duration}</span>
                <Input min={1} max={60} type="number" value={duration} onChange={(event) => setDuration(normalizeDuration(event.target.value))} />
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{copy.prompt}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="min-h-36 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={prompt}
                placeholder={copy.promptPlaceholder}
                onChange={(event) => setPrompt(event.target.value)}
              />
              <Button className="gap-2" disabled={isGenerating || !prompt.trim()} onClick={generateVideos}>
                <WandSparkles size={16} />
                {isGenerating ? copy.generating : copy.generate}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{copy.results}</CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-md border text-center text-sm text-muted-foreground">
                  <Video className="h-8 w-8" />
                  <div>{copy.noResults}</div>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {results.map((result, index) => {
                    const source = videoSource(result)
                    return (
                      <div key={`${index}-${source.slice(0, 36)}-${result.status}`} className="space-y-3 rounded-md border p-3">
                        <div className="aspect-video overflow-hidden rounded-md bg-muted">
                          {source ? <video src={source} controls className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{result.status || copy.noVideoURL}</div>}
                        </div>
                        {result.status && <div className="text-sm text-muted-foreground">{copy.status}: {result.status}</div>}
                        {result.revised_prompt && <div className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{result.revised_prompt}</div>}
                        {source && (
                          <Button asChild variant="outline" size="sm" className="gap-2">
                            <a href={source} download={`video-${index + 1}.mp4`} target={result.url ? "_blank" : undefined} rel={result.url ? "noreferrer" : undefined}>
                              <Download size={15} />
                              {copy.download}
                            </a>
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <PageInlineSlot slotKey="primary" />
      <PageInlineSlot slotKey="secondary" />
    </div>
  )
}

function normalizeCount(value: string) {
  const count = Number.parseInt(value, 10)
  if (!Number.isFinite(count)) {
    return 1
  }
  return Math.min(4, Math.max(1, count))
}

function normalizeDuration(value: string) {
  const duration = Number.parseInt(value, 10)
  if (!Number.isFinite(duration)) {
    return 5
  }
  return Math.min(60, Math.max(1, duration))
}

function normalizeCatalogItem(value: unknown): UserChannelCatalog {
  const item = isRecord(value) ? value : {}
  return {
    id: Number(item.id || 0),
    name: typeof item.name === "string" ? item.name : "",
    models: Array.isArray(item.models) ? item.models.filter((model): model is string => typeof model === "string") : [],
  }
}

function uniqueModels(catalog: UserChannelCatalog[]) {
  return Array.from(new Set(catalog.flatMap((channel) => channel.models))).sort()
}

function parseJSON(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function errorMessage(payload: unknown, text: string, status: number) {
  if (isRecord(payload)) {
    if (typeof payload.error === "string") {
      return payload.error
    }
    if (isRecord(payload.error) && typeof payload.error.message === "string") {
      return payload.error.message
    }
    if (typeof payload.message === "string") {
      return payload.message
    }
  }
  return text || `HTTP ${status}`
}

function videoResultsFromPayload(payload: unknown): VideoResult[] {
  if (!isRecord(payload)) {
    return []
  }
  if (Array.isArray(payload.data)) {
    return payload.data.map(videoResultFromItem).filter((item) => item.url || item.b64_json || item.status)
  }
  const item = videoResultFromItem(payload)
  return item.url || item.b64_json || item.status ? [item] : []
}

function videoResultFromItem(value: unknown): VideoResult {
  const item = isRecord(value) ? value : {}
  const nestedVideo = isRecord(item.video) ? item.video : {}
  return {
    url: firstString(item.url, item.video_url, item.output_url, nestedVideo.url),
    b64_json: firstString(item.b64_json, item.video, item.output, nestedVideo.b64_json),
    revised_prompt: firstString(item.revised_prompt, item.prompt),
    status: firstString(item.status, item.state),
  }
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }
  return ""
}

function videoSource(result: VideoResult) {
  if (result.url) {
    return result.url
  }
  if (result.b64_json.startsWith("data:")) {
    return result.b64_json
  }
  return result.b64_json ? `data:video/mp4;base64,${result.b64_json}` : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

const zhCopy = {
  title: "AI 视频",
  config: "配置",
  apiKey: "API Key",
  keyPlaceholder: "填写 sk- 令牌",
  model: "模型",
  selectModel: "选择模型",
  size: "尺寸",
  count: "数量",
  duration: "时长（秒）",
  auto: "自动",
  prompt: "提示词",
  promptPlaceholder: "输入视频生成提示词",
  generate: "生成",
  generating: "生成中",
  results: "结果",
  noResults: "暂无视频",
  noVideoURL: "响应中没有视频地址",
  status: "状态",
  download: "下载",
  keyRequired: "请填写令牌",
  modelRequired: "请选择模型",
  promptRequired: "请输入提示词",
  generateFailed: "生成失败",
  generated: "已生成 {count} 个视频",
  emptyResponse: "空响应",
}

const enCopy: typeof zhCopy = {
  title: "AI Videos",
  config: "Config",
  apiKey: "API Key",
  keyPlaceholder: "Enter sk- token",
  model: "Model",
  selectModel: "Select model",
  size: "Size",
  count: "Count",
  duration: "Duration (s)",
  auto: "Auto",
  prompt: "Prompt",
  promptPlaceholder: "Enter a video prompt",
  generate: "Generate",
  generating: "Generating",
  results: "Results",
  noResults: "No videos yet",
  noVideoURL: "No video URL in response",
  status: "Status",
  download: "Download",
  keyRequired: "Enter a token first",
  modelRequired: "Select a model",
  promptRequired: "Enter a prompt",
  generateFailed: "Generation failed",
  generated: "Generated {count} videos",
  emptyResponse: "Empty response",
}
