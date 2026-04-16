"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { Header } from "@/components/radar/header"
import { MetricCards } from "@/components/radar/metric-cards"
import { FilterBar } from "@/components/radar/filter-bar"
import { UpdateList } from "@/components/radar/update-list"
import { InsightPanel } from "@/components/radar/insight-panel"
import { WeeklyHighlights } from "@/components/radar/weekly-highlights"
import { Footer } from "@/components/radar/footer"
import { Spinner } from "@/components/ui/spinner"
import {
  normalizeData,
  filterData,
  sortData,
  calculateStats,
  generateTrendInsights,
  calculateTagStats,
  calculateSourceStats,
  calculateRegionStats,
  getWeeklyHighlights,
  getAllTypes,
  getAllSourceTypes,
} from "@/lib/data-utils"
import type { FilterState, AIUpdate } from "@/lib/types"

// 主数据源和回退数据源
const PRIMARY_DATA_URL = "/updates.json"
const FALLBACK_DATA_URL = "/tencent_ai_renamed.json"

// 带回退逻辑的 fetcher
const fetcherWithFallback = async (url: string): Promise<{ data: AIUpdate[]; source: string }> => {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return { data, source: url }
  } catch {
    // 主数据源失败，尝试回退数据源
    if (url === PRIMARY_DATA_URL) {
      const fallbackRes = await fetch(FALLBACK_DATA_URL)
      if (!fallbackRes.ok) throw new Error(`回退数据源也加载失败: HTTP ${fallbackRes.status}`)
      const fallbackData = await fallbackRes.json()
      return { data: fallbackData, source: FALLBACK_DATA_URL }
    }
    throw new Error("所有数据源均加载失败")
  }
}

const defaultFilters: FilterState = {
  timeRange: "全部",
  region: "全部",
  type: "全部",
  sourceType: "全部",
  search: "",
  sortBy: "最新优先",
}

export default function AIRadarPage() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)
  const [isInsightPanelOpen, setIsInsightPanelOpen] = useState(true)

  const { data: result, error, isLoading } = useSWR(PRIMARY_DATA_URL, fetcherWithFallback)
  
  const rawData = result?.data
  const dataSource = result?.source

  // 规范化数据
  const normalizedData = useMemo(() => {
    if (!rawData) return []
    return normalizeData(rawData)
  }, [rawData])

  // 筛选和排序后的数据
  const filteredData = useMemo(() => {
    const filtered = filterData(normalizedData, filters)
    return sortData(filtered, filters.sortBy)
  }, [normalizedData, filters])

  // 计算统计数据
  const stats = useMemo(() => {
    return calculateStats(normalizedData)
  }, [normalizedData])

  // 计算趋势分析
  const insights = useMemo(() => {
    return generateTrendInsights(filteredData)
  }, [filteredData])

  // 标签统计
  const tagStats = useMemo(() => {
    return calculateTagStats(filteredData)
  }, [filteredData])

  // 来源统计
  const sourceStats = useMemo(() => {
    return calculateSourceStats(filteredData)
  }, [filteredData])

  // 地区统计
  const regionStats = useMemo(() => {
    return calculateRegionStats(filteredData)
  }, [filteredData])

  // 本周重点观察
  const weeklyHighlights = useMemo(() => {
    return getWeeklyHighlights(normalizedData)
  }, [normalizedData])

  // 获取类型和来源类型选项
  const typeOptions = useMemo(() => getAllTypes(normalizedData), [normalizedData])
  const sourceTypeOptions = useMemo(() => getAllSourceTypes(normalizedData), [normalizedData])

  // 最近更新时间
  const lastUpdated = useMemo(() => {
    if (normalizedData.length === 0) return "暂无数据"
    const sortedByDate = [...normalizedData].sort((a, b) => b.date.getTime() - a.date.getTime())
    return sortedByDate[0]?.dateStr || "暂无数据"
  }, [normalizedData])

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive text-lg mb-2">数据加载失败，请检查 JSON 文件路径或格式。</p>
          <p className="text-muted-foreground text-sm">
            已尝试: {PRIMARY_DATA_URL} 和 {FALLBACK_DATA_URL}
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Spinner className="w-8 h-8 text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">正在加载数据...</p>
        </div>
      </div>
    )
  }

  // 判断是否使用了回退数据源
  const isUsingFallback = dataSource === FALLBACK_DATA_URL

  return (
    <div className="min-h-screen bg-background">
      <Header lastUpdated={lastUpdated} />
      
      {/* 回退数据源提示 */}
      {isUsingFallback && (
        <div className="bg-signal-medium/20 border-b border-signal-medium/30">
          <div className="container mx-auto px-4 py-2">
            <p className="text-sm text-signal-medium">
              提示：主数据源 ({PRIMARY_DATA_URL}) 不可用，已自动回退至备用数据源。
            </p>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-6">
        {/* 指标卡片 */}
        <section className="mb-6">
          <MetricCards
            overseasCount={stats.overseasCount}
            domesticCount={stats.domesticCount}
            topTags={stats.topTags}
            sourceCount={stats.sourceCount}
          />
        </section>

        {/* 本周重点观察 */}
        {weeklyHighlights.length > 0 && (
          <section className="mb-6">
            <WeeklyHighlights highlights={weeklyHighlights} />
          </section>
        )}

        {/* 筛选区域 */}
        <section className="mb-6">
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            typeOptions={typeOptions}
            sourceTypeOptions={sourceTypeOptions}
          />
        </section>

        {/* 主内容区 */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 左侧：动态信息流 */}
          <div className="flex-1 min-w-0">
            <UpdateList updates={filteredData} />
          </div>

          {/* 右侧：趋势分析面板 */}
          <aside className="w-full lg:w-80 shrink-0">
            {/* 移动端折叠控制 */}
            <div className="lg:hidden mb-4">
              <button
                onClick={() => setIsInsightPanelOpen(!isInsightPanelOpen)}
                className="w-full py-3 px-4 bg-card border border-border rounded-lg text-foreground font-medium text-sm flex items-center justify-between"
              >
                <span>趋势观察面板</span>
                <span className="text-muted-foreground">{isInsightPanelOpen ? "收起" : "展开"}</span>
              </button>
            </div>
            <div className={`${isInsightPanelOpen ? "block" : "hidden"} lg:block`}>
              <InsightPanel
                insights={insights}
                tagStats={tagStats}
                sourceStats={sourceStats}
                regionStats={regionStats}
              />
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
