import { Annotation } from '../types'
import { PageFrameData, SearchableFrame, FrameType } from '../store'

export function detectFrameType(frameName: string): FrameType {
  // Simple heuristics for frame type detection
  const name = frameName.toLowerCase()

  // Component detection (starts with uppercase, often PascalCase)
  if (/^[A-Z]/.test(frameName) && frameName.includes(' ')) {
    return 'component'
  }

  // Instance detection (common component instance patterns)
  if (name.includes('instance') || name.includes('copy')) {
    return 'instance'
  }

  // Group detection
  if (name.includes('group') || /^\(.+\)$/.test(frameName.trim())) {
    return 'group'
  }

  // Section detection
  if (name.includes('section') || name.includes('header') || name.includes('footer')) {
    return 'section'
  }

  // Default to frame
  return 'frame'
}

export function getFrameIcon(frameType: FrameType): string {
  switch (frameType) {
    case 'component':
      return '🧩' // Component symbol
    case 'instance':
      return '📋' // Instance/copy symbol
    case 'group':
      return '📁' // Folder for groups
    case 'section':
      return '📄' // Document for sections
    case 'frame':
    default:
      return '▭' // Frame symbol (rectangle)
  }
}

export function createSearchableFrameData(organizedData: PageFrameData[]): SearchableFrame[] {
  const searchableFrames: SearchableFrame[] = []

  organizedData.forEach(page => {
    page.frames.forEach(frame => {
      searchableFrames.push({
        id: frame.id,
        name: frame.name,
        pageName: page.name,
        annotationCount: frame.annotationCount,
        type: frame.type,
        icon: getFrameIcon(frame.type),
        searchText: `${frame.name} ${page.name}`.toLowerCase()
      })
    })
  })

  return searchableFrames
}

export function organizeFramesByPages(
  screens: { id: string; name: string }[],
  annotations: Annotation[]
): PageFrameData[] {
  // Group frames by page
  const framesByPage = new Map<string, { id: string; name: string; frames: Map<string, { id: string; name: string; annotationCount: number; type: FrameType }> }>()

  // First pass: organize screens into pages
  screens.forEach(screen => {
    // Parse frame name and page name from format "Frame Name (Page Name)"
    const nameMatch = screen.name.match(/^(.+?)\s*\((.+?)\)$/)
    const [, frameNameMatch, pageNameMatch] = nameMatch ?? []
    const frameName = frameNameMatch ? frameNameMatch.trim() : screen.name
    const pageName = pageNameMatch ? pageNameMatch.trim() : 'Default Page'

    if (!framesByPage.has(pageName)) {
      framesByPage.set(pageName, {
        id: pageName,
        name: pageName,
        frames: new Map()
      })
    }
    framesByPage.get(pageName)!.frames.set(screen.id, {
      id: screen.id,
      name: frameName,
      annotationCount: 0,
      type: detectFrameType(frameName)
    })
  })

  // Second pass: count annotations per frame
  annotations.forEach(annotation => {
    const pageName = annotation.pageName || 'Default Page'
    const pageData = framesByPage.get(pageName)
    if (pageData) {
      const frameData = pageData.frames.get(annotation.frameId)
      if (frameData) {
        frameData.annotationCount++
      }
    }
  })

  // Convert to array format
  return Array.from(framesByPage.values()).map(page => ({
    id: page.id,
    name: page.name,
    frames: Array.from(page.frames.values()).sort((a, b) => {
      // Sort by annotation count (frames with annotations first), then by name
      if (a.annotationCount > 0 && b.annotationCount === 0) return -1
      if (a.annotationCount === 0 && b.annotationCount > 0) return 1
      return a.name.localeCompare(b.name)
    })
  })).sort((a, b) => a.name.localeCompare(b.name))
}
