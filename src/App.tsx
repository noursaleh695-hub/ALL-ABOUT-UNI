import { useEffect, useMemo, useState } from 'react'
import {
  auth,
  getWorkspaceDocument,
  isFirebaseConfigured,
  saveWorkspace,
  signInAnonymously,
  uploadMaterialFile,
} from './firebase'
import './App.css'

type NavKey =
  | 'dashboard'
  | 'subjects'
  | 'materials'
  | 'assignments'
  | 'recent'
  | 'favorites'
  | 'trash'
  | 'search'
  | 'settings'

type ThemeMode = 'light' | 'dark'

type Subject = {
  id: string
  name: string
  code: string
  icon: string
  color: string
  description: string
  categories: string[]
}

type Material = {
  id: string
  title: string
  subjectId: string
  materialType: string
  category: string
  topic: string
  description: string
  tags: string[]
  dateAdded: string
  lectureNumber?: string
  dueDate?: string
  favorite: boolean
  fileName: string
  fileType: string
  previewUrl?: string
  deleted: boolean
  isSample?: boolean
  lastOpenedAt?: string
}

type Assignment = {
  id: string
  title: string
  subjectId: string
  description: string
  dueDate: string
  dueTime?: string
  priority: 'Low' | 'Medium' | 'High'
  status: 'Not Started' | 'In Progress' | 'Completed'
  relatedMaterialIds: string[]
  notes: string
}

type OrganizerState = {
  subjects: Subject[]
  materials: Material[]
  assignments: Assignment[]
}

const STORAGE_KEY = 'helwan-academic-organizer-v1'
const defaultCategories = [
  'Lectures and Notes',
  'Lecture Materials',
  'Sheets and Exercises',
  'Assignments',
  'Reference Materials',
  'Other',
]

const materialTypes = [
  'Lecture Note',
  'Lecture Material',
  'Exercise Sheet',
  'Assignment',
  'Reference',
  'Other',
]

const navItems: { key: NavKey; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '▣' },
  { key: 'subjects', label: 'My Subjects', icon: '◫' },
  { key: 'materials', label: 'All Materials', icon: '▤' },
  { key: 'assignments', label: 'Assignments', icon: '✓' },
  { key: 'recent', label: 'Recent Files', icon: '⏱' },
  { key: 'favorites', label: 'Favorites', icon: '★' },
  { key: 'trash', label: 'Trash', icon: '🗑' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
]

const allowedExtensions = ['pdf', 'ppt', 'pptx', 'png', 'jpg', 'jpeg', 'webp', 'txt']

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const formatDate = (value: string | undefined) => {
  if (!value) return 'No date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date'
  return new Intl.DateTimeFormat('en-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const formatDateTime = (value?: string) => {
  if (!value) return 'No due date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No due date'
  return new Intl.DateTimeFormat('en-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const getPreviewNote = (material: Material) => {
  if (!material.previewUrl) {
    if (material.fileType === 'image') {
      return 'Preview unavailable for this sample or non-stored item.'
    }
    if (material.fileType === 'pdf') {
      return 'PDF preview is not available for this reference item. Use open or download.'
    }
    if (material.fileType === 'text') {
      return 'Text preview is not available for this item.'
    }
    return 'Preview is not supported for this file type.'
  }
  return ''
}

const getFileTypeFromName = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['ppt', 'pptx'].includes(ext)) return 'presentation'
  if (ext === 'txt') return 'text'
  return 'other'
}

const toDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })

const seedSubjects: Subject[] = [
  {
    id: 'math',
    name: 'Mathematics',
    code: 'MTH101',
    icon: '∑',
    color: '#4f46e5',
    description: 'Calculus, algebra, and problem solving.',
    categories: [...defaultCategories],
  },
  {
    id: 'mechanics',
    name: 'Mechanics',
    code: 'MEC102',
    icon: '⚙',
    color: '#0f766e',
    description: 'Statics, dynamics, and force analysis.',
    categories: [...defaultCategories],
  },
  {
    id: 'physics',
    name: 'Physics',
    code: 'PHY103',
    icon: '◌',
    color: '#0ea5e9',
    description: 'Core concepts, labs, and formulas.',
    categories: [...defaultCategories],
  },
  {
    id: 'chem',
    name: 'Chemistry',
    code: 'CHM104',
    icon: '⚗',
    color: '#f59e0b',
    description: 'General chemistry and practical notes.',
    categories: [...defaultCategories],
  },
  {
    id: 'coding',
    name: 'Computer Techniques',
    code: 'CTE105',
    icon: '⌨',
    color: '#22c55e',
    description: 'Programming, computing, and labs.',
    categories: [...defaultCategories],
  },
  {
    id: 'drawing',
    name: 'Engineering Drawing',
    code: 'ENG106',
    icon: '✎',
    color: '#ef4444',
    description: 'Drafting, visuals, and technical diagrams.',
    categories: [...defaultCategories],
  },
  {
    id: 'english',
    name: 'English',
    code: 'ENG107',
    icon: 'A',
    color: '#8b5cf6',
    description: 'Writing, communication, and reading skills.',
    categories: [...defaultCategories],
  },
]

const buildSeedState = (): OrganizerState => {
  const now = new Date()
  const dateOffset = (days: number) => new Date(now.getTime() + days * 86400000).toISOString()

  const seedMaterials: Material[] = [
    {
      id: 'm1',
      title: 'Lecture 01 Board Notes',
      subjectId: 'math',
      materialType: 'Lecture Note',
      category: 'Lectures and Notes',
      topic: 'Limits and continuity',
      description: 'Board notes from the first class on limits.',
      tags: ['board', 'lecture', 'sample'],
      dateAdded: dateOffset(-2),
      lectureNumber: '1',
      favorite: true,
      fileName: 'Lecture 01 Board Notes.png',
      fileType: 'image',
      previewUrl: '',
      deleted: false,
      isSample: true,
    },
    {
      id: 'm2',
      title: 'Tutorial Sheet 02',
      subjectId: 'math',
      materialType: 'Exercise Sheet',
      category: 'Sheets and Exercises',
      topic: 'Differentiation',
      description: 'Practice questions and worked examples.',
      tags: ['tutorial', 'sample'],
      dateAdded: dateOffset(-5),
      favorite: false,
      fileName: 'Tutorial Sheet 02.pdf',
      fileType: 'pdf',
      previewUrl: '',
      deleted: false,
      isSample: true,
    },
    {
      id: 'm3',
      title: 'Friction Problems',
      subjectId: 'mechanics',
      materialType: 'Exercise Sheet',
      category: 'Sheets and Exercises',
      topic: 'Friction',
      description: 'Worked friction examples and diagrams.',
      tags: ['friction', 'sample'],
      dateAdded: dateOffset(-7),
      favorite: false,
      fileName: 'Friction Problems.pdf',
      fileType: 'pdf',
      previewUrl: '',
      deleted: false,
      isSample: true,
    },
    {
      id: 'm4',
      title: 'Lecture 03 Slides',
      subjectId: 'physics',
      materialType: 'Lecture Material',
      category: 'Lecture Materials',
      topic: 'Electric fields',
      description: 'Slides covering electric field calculations.',
      tags: ['slides', 'sample'],
      dateAdded: dateOffset(-8),
      lectureNumber: '3',
      favorite: true,
      fileName: 'Lecture 03 Slides.pdf',
      fileType: 'pdf',
      previewUrl: '',
      deleted: false,
      isSample: true,
    },
    {
      id: 'm5',
      title: 'Chapter 01 Notes',
      subjectId: 'chem',
      materialType: 'Lecture Note',
      category: 'Lectures and Notes',
      topic: 'Atomic structure',
      description: 'Summary of chapter one notes.',
      tags: ['summary', 'sample'],
      dateAdded: dateOffset(-10),
      favorite: false,
      fileName: 'Chapter 01 Notes.pdf',
      fileType: 'pdf',
      previewUrl: '',
      deleted: false,
      isSample: true,
    },
    {
      id: 'm6',
      title: 'Assignment 01',
      subjectId: 'coding',
      materialType: 'Assignment',
      category: 'Assignments',
      topic: 'Python basics',
      description: 'Assignment instructions and starter notes.',
      tags: ['assignment', 'sample'],
      dateAdded: dateOffset(-12),
      dueDate: dateOffset(2),
      favorite: false,
      fileName: 'Assignment 01.pdf',
      fileType: 'pdf',
      previewUrl: '',
      deleted: false,
      isSample: true,
    },
    {
      id: 'm7',
      title: 'Week 02 Practice',
      subjectId: 'drawing',
      materialType: 'Reference',
      category: 'Reference Materials',
      topic: 'Dimensioning',
      description: 'Practice exercises for isometric views.',
      tags: ['drawing', 'sample'],
      dateAdded: dateOffset(-15),
      favorite: false,
      fileName: 'Week 02 Practice.jpg',
      fileType: 'image',
      previewUrl: '',
      deleted: false,
      isSample: true,
    },
  ]

  const seedAssignments: Assignment[] = [
    {
      id: 'a1',
      title: 'Calculus worksheet',
      subjectId: 'math',
      description: 'Complete questions 1-10 before Friday.',
      dueDate: dateOffset(1),
      dueTime: '18:00',
      priority: 'High',
      status: 'In Progress',
      relatedMaterialIds: ['m2'],
      notes: 'Need to review chain rule examples.',
    },
    {
      id: 'a2',
      title: 'Physics lab report',
      subjectId: 'physics',
      description: 'Summarize the electric field experiment.',
      dueDate: dateOffset(-1),
      dueTime: '09:00',
      priority: 'Medium',
      status: 'Completed',
      relatedMaterialIds: ['m4'],
      notes: 'Submitted last week.',
    },
    {
      id: 'a3',
      title: 'Computer techniques quiz prep',
      subjectId: 'coding',
      description: 'Revise loops, arrays and debugging basics.',
      dueDate: dateOffset(4),
      dueTime: '16:30',
      priority: 'Low',
      status: 'Not Started',
      relatedMaterialIds: ['m6'],
      notes: 'Review lab activities.',
    },
  ]

  return {
    subjects: seedSubjects,
    materials: seedMaterials,
    assignments: seedAssignments,
  }
}

const loadState = (): OrganizerState => {
  if (typeof window === 'undefined') return buildSeedState()

  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return buildSeedState()

  try {
    const parsed = JSON.parse(raw) as OrganizerState
    if (!parsed || !Array.isArray(parsed.subjects) || !Array.isArray(parsed.materials)) {
      return buildSeedState()
    }
    return parsed
  } catch {
    return buildSeedState()
  }
}

function App() {
  const initialState = useMemo(() => loadState(), [])
  const [subjects, setSubjects] = useState<Subject[]>(initialState.subjects)
  const [materials, setMaterials] = useState<Material[]>(initialState.materials)
  const [assignments, setAssignments] = useState<Assignment[]>(initialState.assignments)
  const [activeNav, setActiveNav] = useState<NavKey>('dashboard')
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialState.subjects[0]?.id ?? '')
  const [subjectSearch, setSubjectSearch] = useState('')
  const [subjectView, setSubjectView] = useState<'grid' | 'list'>('grid')
  const [searchInput, setSearchInput] = useState('')
  const [searchSubject, setSearchSubject] = useState('all')
  const [searchCategory, setSearchCategory] = useState('all')
  const [searchType, setSearchType] = useState('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortMode, setSortMode] = useState('newest')
  const [isDarkTheme, setIsDarkTheme] = useState<ThemeMode>('light')
  const [storageMode, setStorageMode] = useState<'local' | 'firebase'>('local')
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadSaving, setUploadSaving] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [uploadForm, setUploadForm] = useState({
    subjectId: initialState.subjects[0]?.id ?? '',
    materialType: 'Lecture Note',
    category: defaultCategories[0],
    topic: '',
    description: '',
    tags: '',
  })

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      if (!isFirebaseConfigured()) {
        const seed = loadState()
        if (!cancelled) {
          setSubjects(seed.subjects)
          setMaterials(seed.materials)
          setAssignments(seed.assignments)
          setSelectedSubjectId(seed.subjects[0]?.id ?? '')
          setStorageMode('local')
          setUploadForm((current) => ({
            ...current,
            subjectId: seed.subjects[0]?.id ?? '',
          }))
        }
        return
      }

      try {
        const user = auth?.currentUser ?? (await signInAnonymously())?.user
        if (!user || cancelled) return

        const saved = await getWorkspaceDocument(user.uid)
        if (!cancelled) {
          if (saved && Array.isArray((saved as Record<string, unknown>).subjects)) {
            const remoteState = saved as OrganizerState
            setSubjects(remoteState.subjects)
            setMaterials(remoteState.materials)
            setAssignments(remoteState.assignments)
            setSelectedSubjectId(remoteState.subjects[0]?.id ?? '')
            setUploadForm((current) => ({
              ...current,
              subjectId: remoteState.subjects[0]?.id ?? '',
            }))
          } else {
            const seed = loadState()
            setSubjects(seed.subjects)
            setMaterials(seed.materials)
            setAssignments(seed.assignments)
            setSelectedSubjectId(seed.subjects[0]?.id ?? '')
            setUploadForm((current) => ({
              ...current,
              subjectId: seed.subjects[0]?.id ?? '',
            }))
          }

          setStorageMode('firebase')
        }
      } catch {
        if (!cancelled) {
          const seed = loadState()
          setSubjects(seed.subjects)
          setMaterials(seed.materials)
          setAssignments(seed.assignments)
          setSelectedSubjectId(seed.subjects[0]?.id ?? '')
          setStorageMode('local')
          setToast('Firebase unavailable — local backup is active')
        }
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (storageMode === 'local') {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          subjects,
          materials,
          assignments,
        }),
      )
      return
    }

    if (storageMode === 'firebase' && auth?.currentUser) {
      void saveWorkspace(auth.currentUser.uid, { subjects, materials, assignments }).catch(() => {
        setStorageMode('local')
      })
    }
  }, [subjects, materials, assignments, storageMode])

  useEffect(() => {
    if (!selectedSubjectId && subjects.length > 0) setSelectedSubjectId(subjects[0].id)
  }, [selectedSubjectId, subjects])

  useEffect(() => {
    if (toast) {
      const timeout = window.setTimeout(() => setToast(null), 2200)
      return () => window.clearTimeout(timeout)
    }
  }, [toast])

  useEffect(() => {
    if (uploadOpen && !uploadFiles.length) {
      setUploadError('')
    }
  }, [uploadFiles, uploadOpen])

  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId) ?? subjects[0]
  const uploadSubject = subjects.find((subject) => subject.id === uploadForm.subjectId)
  const currentMaterial = materials.find((material) => material.id === selectedMaterialId)
  const sanitizedSearch = searchInput.trim().toLowerCase()

  const openUpload = (subjectId?: string, category?: string) => {
    const targetSubject = subjects.find((subject) => subject.id === (subjectId ?? selectedSubject?.id)) ?? subjects[0]
    if (!targetSubject) return

    setUploadForm((current) => ({
      ...current,
      subjectId: targetSubject.id,
      category:
        category && targetSubject.categories.includes(category)
          ? category
          : targetSubject.categories.includes(current.category)
            ? current.category
            : targetSubject.categories[0] ?? defaultCategories[0],
    }))
    setUploadError('')
    setUploadOpen(true)
  }

  const allAvailableCategories = useMemo(
    () => Array.from(new Set(subjects.flatMap((subject) => subject.categories))),
    [subjects],
  )

  const activeMaterials = useMemo(
    () => materials.filter((material) => !material.deleted),
    [materials],
  )

  const recentMaterials = useMemo(
    () =>
      [...activeMaterials]
        .filter((material) => material.lastOpenedAt)
        .sort((a, b) => Number(new Date(b.lastOpenedAt ?? 0)) - Number(new Date(a.lastOpenedAt ?? 0))),
    [activeMaterials],
  )

  const favoriteMaterials = useMemo(
    () => activeMaterials.filter((material) => material.favorite),
    [activeMaterials],
  )

  const trashMaterials = useMemo(
    () => materials.filter((material) => material.deleted),
    [materials],
  )

  const filteredSearchResults = useMemo(() => {
    const query = sanitizedSearch
    const items = activeMaterials.filter((material) => {
      const subjectName = subjects.find((subject) => subject.id === material.subjectId)?.name ?? ''
      const matchesSearch =
        !query ||
        [
          material.title,
          material.topic,
          material.description,
          material.fileName,
          material.materialType,
          subjectName,
          material.tags.join(' '),
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)

      const matchesSubject = searchSubject === 'all' || material.subjectId === searchSubject
      const matchesCategory = searchCategory === 'all' || material.category === searchCategory
      const matchesType = searchType === 'all' || material.materialType === searchType
      const matchesFavorite = !favoritesOnly || material.favorite

      return matchesSearch && matchesSubject && matchesCategory && matchesType && matchesFavorite
    })

    const sorted = [...items]
    if (sortMode === 'oldest') {
      sorted.sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime())
    } else if (sortMode === 'alphabetical') {
      sorted.sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortMode === 'newest') {
      sorted.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
    }

    return sorted
  }, [activeMaterials, subjects, sanitizedSearch, searchSubject, searchCategory, searchType, favoritesOnly, sortMode])

  const dashboardSubjects = useMemo(
    () =>
      subjects.map((subject) => {
        const subjectMaterials = activeMaterials.filter((material) => material.subjectId === subject.id)
        const pendingAssignments = assignments.filter(
          (assignment) => assignment.subjectId === subject.id && assignment.status !== 'Completed',
        )

        return {
          ...subject,
          materialCount: subjectMaterials.length,
          pendingCount: pendingAssignments.length,
        }
      }),
    [activeMaterials, assignments, subjects],
  )

  const recentAddedMaterials = useMemo(
    () =>
      [...activeMaterials].sort(
        (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime(),
      ),
    [activeMaterials],
  )

  const upcomingAssignments = useMemo(
    () =>
      [...assignments]
        .filter((assignment) => assignment.status !== 'Completed')
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [assignments],
  )

  const handleAddSubject = () => {
    const value = window.prompt('New subject name', 'New Subject')
    if (!value) return
    const subjectName = value.trim()
    if (!subjectName) return

    const newSubject: Subject = {
      id: createId(),
      name: subjectName,
      code: `SUB${subjects.length + 1}`,
      icon: '•',
      color: '#4f46e5',
      description: 'Custom subject workspace.',
      categories: [...defaultCategories],
    }

    setSubjects((current) => [...current, newSubject])
    setSelectedSubjectId(newSubject.id)
    setActiveNav('subjects')
    setToast('Subject created')
  }

  const handleRenameSubject = (subjectId: string) => {
    const subject = subjects.find((item) => item.id === subjectId)
    if (!subject) return
    const nextName = window.prompt('Rename subject', subject.name)
    if (!nextName) return
    const trimmed = nextName.trim()
    if (!trimmed) return

    setSubjects((current) =>
      current.map((item) =>
        item.id === subjectId ? { ...item, name: trimmed } : item,
      ),
    )
    setToast('Subject renamed')
  }

  const handleDeleteSubject = (subjectId: string) => {
    const subject = subjects.find((item) => item.id === subjectId)
    if (!subject) return

    const confirmed = window.confirm(`Delete ${subject.name}? This will keep the materials in the trash.`)
    if (!confirmed) return

    setSubjects((current) => current.filter((item) => item.id !== subjectId))
    setMaterials((current) =>
      current.map((material) =>
        material.subjectId === subjectId ? { ...material, deleted: true } : material,
      ),
    )
    setSelectedSubjectId(subjects.find((item) => item.id !== subjectId)?.id ?? '')
    setToast('Subject deleted and materials moved to trash')
  }

  const handleAddCategory = (subjectId: string) => {
    const name = window.prompt('New category name', 'Custom Folder')
    if (!name) return
    const trimmed = name.trim()
    if (!trimmed) return

    setSubjects((current) =>
      current.map((subject) =>
        subject.id === subjectId
          ? {
              ...subject,
              categories: subject.categories.includes(trimmed)
                ? subject.categories
                : [...subject.categories, trimmed],
            }
          : subject,
      ),
    )
    setToast('Category created')
  }

  const handleRenameCategory = (subjectId: string, category: string) => {
    const nextName = window.prompt('Rename category', category)
    if (!nextName) return
    const trimmed = nextName.trim()
    if (!trimmed) return

    setSubjects((current) =>
      current.map((subject) => {
        if (subject.id !== subjectId) return subject
        return {
          ...subject,
          categories: subject.categories.map((name) => (name === category ? trimmed : name)),
        }
      }),
    )
    setMaterials((current) =>
      current.map((material) =>
        material.subjectId === subjectId && material.category === category
          ? { ...material, category: trimmed }
          : material,
      ),
    )
    setToast('Category updated')
  }

  const handleOpenMaterial = (materialId: string) => {
    setSelectedMaterialId(materialId)
    setMaterials((current) =>
      current.map((material) =>
        material.id === materialId
          ? { ...material, lastOpenedAt: new Date().toISOString() }
          : material,
      ),
    )
  }

  const handleToggleFavorite = (materialId: string) => {
    setMaterials((current) =>
      current.map((material) =>
        material.id === materialId ? { ...material, favorite: !material.favorite } : material,
      ),
    )
    setToast('Favorite updated')
  }

  const handleMoveMaterial = (materialId: string, nextCategory: string) => {
    setMaterials((current) =>
      current.map((material) =>
        material.id === materialId ? { ...material, category: nextCategory } : material,
      ),
    )
  }

  const handleDeleteMaterial = (materialId: string) => {
    const target = materials.find((material) => material.id === materialId)
    if (!target) return
    const confirmed = window.confirm(`Move ${target.title} to trash?`)
    if (!confirmed) return

    setMaterials((current) =>
      current.map((material) =>
        material.id === materialId ? { ...material, deleted: true, favorite: false } : material,
      ),
    )
    setSelectedMaterialId(null)
    setToast('Material moved to trash')
  }

  const handleRestoreMaterial = (materialId: string) => {
    setMaterials((current) =>
      current.map((material) =>
        material.id === materialId ? { ...material, deleted: false } : material,
      ),
    )
    setToast('Material restored')
  }

  const handlePermanentDelete = (materialId: string) => {
    const target = materials.find((material) => material.id === materialId)
    if (!target) return
    const confirmed = window.confirm(`Permanently delete ${target.title}? This cannot be undone.`)
    if (!confirmed) return

    setMaterials((current) => current.filter((material) => material.id !== materialId))
    setToast('Material permanently deleted')
  }

  const submitUpload = async () => {
    if (!uploadFiles.length || uploadSaving) return

    const files = uploadFiles.filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      return allowedExtensions.includes(ext)
    })

    if (!files.length) {
      setUploadError('Unsupported file type. Use PDF, PPT, PPTX, PNG, JPG, JPEG, WEBP, or TXT.')
      return
    }

    setUploadSaving(true)
    setUploadError('')

    try {
      const currentUser = auth?.currentUser ?? (await signInAnonymously())?.user
      const effectiveFirebase = isFirebaseConfigured() && !!currentUser

      const created = await Promise.all(
        files.map(async (file) => {
          const detectedType = getFileTypeFromName(file.name)
          const trimmedTags = uploadForm.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)

          let previewUrl = ''
          if (effectiveFirebase && currentUser) {
            previewUrl = await uploadMaterialFile(currentUser.uid, file)
          } else {
            previewUrl = await toDataUrl(file)
          }

          return {
            id: createId(),
            title: file.name.replace(/\.[^.]+$/, '') || 'Uploaded file',
            subjectId: uploadForm.subjectId,
            materialType: uploadForm.materialType,
            category: uploadForm.category,
            topic: uploadForm.topic || 'General',
            description: uploadForm.description,
            tags: trimmedTags,
            dateAdded: new Date().toISOString(),
            favorite: false,
            fileName: file.name,
            fileType: detectedType,
            previewUrl: detectedType === 'image' || detectedType === 'text' || detectedType === 'pdf' ? previewUrl : '',
            deleted: false,
          } as Material
        }),
      )

      setMaterials((current) => [...created, ...current])
      setUploadFiles([])
      setUploadForm({
        subjectId: subjects[0]?.id ?? '',
        materialType: 'Lecture Note',
        category: defaultCategories[0],
        topic: '',
        description: '',
        tags: '',
      })
      setUploadOpen(false)
      setToast('Files uploaded successfully')
    } catch {
      setUploadError('The upload could not be completed. Please try again with a smaller file.')
    } finally {
      setUploadSaving(false)
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return
    const incoming = Array.from(event.target.files)
    setUploadFiles((current) => [...current, ...incoming])
    event.target.value = ''
  }

  const addAssignment = () => {
    const subjectId = subjects[0]?.id ?? ''
    const titleValue = window.prompt('Assignment title', 'New assignment')
    if (!titleValue) return

    const dueValue = window.prompt('Due date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10))
    if (!dueValue) return

    const newAssignment: Assignment = {
      id: createId(),
      title: titleValue.trim(),
      subjectId,
      description: 'Add instructions or notes.',
      dueDate: dueValue,
      dueTime: '17:00',
      priority: 'Medium',
      status: 'Not Started',
      relatedMaterialIds: [],
      notes: '',
    }

    setAssignments((current) => [newAssignment, ...current])
    setActiveNav('assignments')
    setToast('Assignment added')
  }

  const updateAssignmentStatus = (assignmentId: string, status: Assignment['status']) => {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, status } : assignment,
      ),
    )
  }

  const renderMaterialCard = (material: Material) => {
    const subject = subjects.find((item) => item.id === material.subjectId)
    const typeLabel = material.fileType.toUpperCase()

    return (
      <div key={material.id} className="material-card" onClick={() => handleOpenMaterial(material.id)}>
        <div className="material-card-top">
          <span className="material-icon">{material.fileType === 'image' ? '🖼' : material.fileType === 'pdf' ? '📄' : material.fileType === 'text' ? '📝' : '📁'}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Toggle favorite"
            onClick={(event) => {
              event.stopPropagation()
              handleToggleFavorite(material.id)
            }}
          >
            {material.favorite ? '★' : '☆'}
          </button>
        </div>
        <div className="material-card-body">
          <h4>{material.title}</h4>
          <p>{subject?.name ?? 'Subject'} · {material.category}</p>
          <div className="tag-row">
            <span>{material.materialType}</span>
            <span>{typeLabel}</span>
            {material.isSample ? <span className="sample-tag">Sample</span> : null}
          </div>
          <small>{formatDate(material.dateAdded)}</small>
        </div>
      </div>
    )
  }

  return (
    <div className={`app-shell ${isDarkTheme === 'dark' ? 'dark' : ''}`}>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">HE</div>
          <div>
            <strong>Helwan</strong>
            <span>Academic Organizer</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              type="button"
              key={item.key}
              className={activeNav === item.key ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveNav(item.key)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="profile-card">
          <div className="avatar">ST</div>
          <div>
            <strong>Student</strong>
            <small>First Year</small>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="search-wrap">
            <span>⌕</span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setActiveNav('search')
                }
              }}
              placeholder="Search materials, topics, subjects..."
            />
          </div>

          <div className="topbar-actions">
            <button type="button" className="primary-button" onClick={() => setUploadOpen(true)}>
              ＋ Quick add
            </button>
            <button type="button" className="secondary-button" onClick={() => setIsDarkTheme((value) => (value === 'light' ? 'dark' : 'light'))}>
              {isDarkTheme === 'light' ? 'Dark mode' : 'Light mode'}
            </button>
            <button type="button" className="icon-button large" aria-label="Profile settings">
              ⚙
            </button>
          </div>
        </header>

        {toast ? <div className="toast">{toast}</div> : null}

        {activeNav === 'dashboard' ? (
          <div className="page">
            <section className="welcome-card">
              <div>
                <p className="eyebrow">{getGreeting()}</p>
                <h1>Welcome back, Student</h1>
                <small>{new Intl.DateTimeFormat('en-EG', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())}</small>
              </div>
              <div className="welcome-actions">
                <button type="button" className="primary-button" onClick={() => setUploadOpen(true)}>Add material</button>
                <button type="button" className="secondary-button" onClick={handleAddSubject}>Create subject</button>
              </div>
            </section>

            <section className="dashboard-grid">
              <div className="panel">
                <div className="panel-header">
                  <h3>Subjects</h3>
                  <button type="button" className="text-button" onClick={handleAddSubject}>Add</button>
                </div>
                <div className="subject-grid">
                  {dashboardSubjects.map((subject) => (
                    <button
                      type="button"
                      key={subject.id}
                      className="subject-card"
                      style={{ borderColor: subject.color }}
                      onClick={() => {
                        setSelectedSubjectId(subject.id)
                        setActiveNav('subjects')
                      }}
                    >
                      <div className="subject-card-top">
                        <span className="subject-icon" style={{ background: subject.color }}>
                          {subject.icon}
                        </span>
                        <span className="subject-code">{subject.code}</span>
                      </div>
                      <h4>{subject.name}</h4>
                      <div className="subject-meta">
                        <span>{subject.materialCount} materials</span>
                        <span>{subject.pendingCount} pending</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3>Recently added</h3>
                  <button type="button" className="text-button" onClick={() => setActiveNav('materials')}>View all</button>
                </div>
                <div className="stack-list">
                  {recentAddedMaterials.slice(0, 5).map((material) => (
                    <button key={material.id} type="button" className="list-item" onClick={() => handleOpenMaterial(material.id)}>
                      <div>
                        <strong>{material.title}</strong>
                        <small>
                          {subjects.find((subject) => subject.id === material.subjectId)?.name} · {material.fileType}
                        </small>
                      </div>
                      <span>{formatDate(material.dateAdded)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="bottom-panels">
              <div className="panel">
                <div className="panel-header">
                  <h3>Upcoming assignments</h3>
                  <button type="button" className="text-button" onClick={() => setActiveNav('assignments')}>Open</button>
                </div>
                <div className="stack-list compact">
                  {upcomingAssignments.slice(0, 5).map((assignment) => (
                    <div key={assignment.id} className="assignment-row">
                      <div>
                        <strong>{assignment.title}</strong>
                        <small>{subjects.find((subject) => subject.id === assignment.subjectId)?.name}</small>
                      </div>
                      <div className="assignment-badges">
                        <span className={assignment.status === 'Completed' ? 'status completed' : assignment.status === 'In Progress' ? 'status in-progress' : 'status pending'}>
                          {assignment.status}
                        </span>
                        <span className="due-pill">{formatDateTime(assignment.dueDate)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3>Quick actions</h3>
                </div>
                <div className="quick-actions">
                  <button type="button" className="secondary-button" onClick={() => setUploadOpen(true)}>Add material</button>
                  <button type="button" className="secondary-button" onClick={handleAddSubject}>Create subject</button>
                  <button type="button" className="secondary-button" onClick={addAssignment}>Add assignment</button>
                  <button type="button" className="secondary-button" onClick={() => setActiveNav('search')}>Search materials</button>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {activeNav === 'subjects' && selectedSubject ? (
          <div className="page">
            <section className="subject-topbar">
              <div>
                <p className="eyebrow">Subject workspace</p>
                <h2>{selectedSubject.name}</h2>
                <small>{selectedSubject.description}</small>
              </div>
              <div className="subject-controls">
                <input
                  value={subjectSearch}
                  onChange={(event) => setSubjectSearch(event.target.value)}
                  placeholder="Search this subject"
                />
                <div className="segmented-controls">
                  <button type="button" className={subjectView === 'grid' ? 'segmented active' : 'segmented'} onClick={() => setSubjectView('grid')}>Grid</button>
                  <button type="button" className={subjectView === 'list' ? 'segmented active' : 'segmented'} onClick={() => setSubjectView('list')}>List</button>
                </div>
                <button type="button" className="secondary-button" onClick={() => handleRenameSubject(selectedSubject.id)}>Rename</button>
                <button type="button" className="secondary-button" onClick={() => handleDeleteSubject(selectedSubject.id)}>Delete</button>
                <button type="button" className="primary-button" onClick={() => setUploadOpen(true)}>Upload</button>
              </div>
            </section>

            <div className="subject-selector-row">
              {subjects.map((subject) => (
                <button
                  type="button"
                  key={subject.id}
                  className={selectedSubjectId === subject.id ? 'subject-pill active' : 'subject-pill'}
                  onClick={() => setSelectedSubjectId(subject.id)}
                >
                  {subject.name}
                </button>
              ))}
            </div>

            <section className="category-list">
              {selectedSubject.categories.map((category) => {
                const categoryMaterials = materials.filter(
                  (material) =>
                    material.subjectId === selectedSubject.id &&
                    !material.deleted &&
                    material.category === category &&
                    [material.title, material.topic, material.description, material.fileName]
                      .join(' ')
                      .toLowerCase()
                      .includes(subjectSearch.toLowerCase()),
                )

                return (
                  <div key={category} className="category-panel">
                    <div className="panel-header">
                      <h3>{category}</h3>
                      <div className="inline-actions">
                        <button type="button" className="text-button" onClick={() => handleRenameCategory(selectedSubject.id, category)}>Rename</button>
                        <button type="button" className="text-button" onClick={() => handleAddCategory(selectedSubject.id)}>Add folder</button>
                        <button type="button" className="text-button" onClick={() => openUpload(selectedSubject.id, category)}>Add files</button>
                      </div>
                    </div>

                    {categoryMaterials.length ? (
                      subjectView === 'grid' ? (
                        <div className="material-grid">{categoryMaterials.map(renderMaterialCard)}</div>
                      ) : (
                        <div className="material-list">{categoryMaterials.map((material) => (
                          <div key={material.id} className="material-list-row" onClick={() => handleOpenMaterial(material.id)}>
                            <div className="material-list-main">
                              <strong>{material.title}</strong>
                              <small>{material.materialType} • {material.topic}</small>
                            </div>
                            <span>{formatDate(material.dateAdded)}</span>
                          </div>
                        ))}</div>
                      )
                    ) : (
                      <div className="empty-card">No files in this category yet.</div>
                    )}
                  </div>
                )
              })}
            </section>
          </div>
        ) : null}

        {activeNav === 'materials' ? (
          <div className="page">
            <section className="section-header">
              <div>
                <p className="eyebrow">Library</p>
                <h2>All materials</h2>
              </div>
              <button type="button" className="primary-button" onClick={() => setUploadOpen(true)}>Upload new</button>
            </section>
            <div className="material-grid">{activeMaterials.map(renderMaterialCard)}</div>
          </div>
        ) : null}

        {activeNav === 'assignments' ? (
          <div className="page">
            <section className="section-header">
              <div>
                <p className="eyebrow">Deadlines</p>
                <h2>Assignments</h2>
              </div>
              <button type="button" className="primary-button" onClick={addAssignment}>Add assignment</button>
            </section>

            <div className="assignment-list">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="assignment-card">
                  <div className="assignment-header">
                    <div>
                      <h3>{assignment.title}</h3>
                      <small>{subjects.find((subject) => subject.id === assignment.subjectId)?.name}</small>
                    </div>
                    <span className={assignment.status === 'Completed' ? 'status completed' : assignment.status === 'In Progress' ? 'status in-progress' : 'status pending'}>
                      {assignment.status}
                    </span>
                  </div>
                  <p>{assignment.description}</p>
                  <div className="assignment-meta">
                    <span>Due: {formatDateTime(assignment.dueDate)}</span>
                    <span>Priority: {assignment.priority}</span>
                  </div>
                  <div className="assignment-actions">
                    <select
                      value={assignment.status}
                      onChange={(event) =>
                        updateAssignmentStatus(assignment.id, event.target.value as Assignment['status'])
                      }
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <button type="button" className="secondary-button" onClick={() => setActiveNav('materials')}>Attach files</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeNav === 'favorites' ? (
          <div className="page">
            <section className="section-header">
              <div>
                <p className="eyebrow">Quick access</p>
                <h2>Favorites</h2>
              </div>
            </section>
            {favoriteMaterials.length ? (
              <div className="material-grid">{favoriteMaterials.map(renderMaterialCard)}</div>
            ) : (
              <div className="empty-card">No favorite files yet.</div>
            )}
          </div>
        ) : null}

        {activeNav === 'recent' ? (
          <div className="page">
            <section className="section-header">
              <div>
                <p className="eyebrow">History</p>
                <h2>Recent files</h2>
              </div>
            </section>
            {recentMaterials.length ? (
              <div className="material-grid">{recentMaterials.map(renderMaterialCard)}</div>
            ) : (
              <div className="empty-card">Open a file to build your recent list.</div>
            )}
          </div>
        ) : null}

        {activeNav === 'trash' ? (
          <div className="page">
            <section className="section-header">
              <div>
                <p className="eyebrow">Recovery</p>
                <h2>Trash</h2>
              </div>
            </section>
            {trashMaterials.length ? (
              <div className="trash-list">
                {trashMaterials.map((material) => (
                  <div key={material.id} className="trash-item">
                    <div>
                      <strong>{material.title}</strong>
                      <small>{material.fileName}</small>
                    </div>
                    <div className="trash-actions">
                      <button type="button" className="secondary-button" onClick={() => handleRestoreMaterial(material.id)}>Restore</button>
                      <button type="button" className="primary-button danger" onClick={() => handlePermanentDelete(material.id)}>Delete permanently</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-card">No deleted files.</div>
            )}
          </div>
        ) : null}

        {activeNav === 'search' ? (
          <div className="page">
            <section className="section-header">
              <div>
                <p className="eyebrow">Search</p>
                <h2>Material search</h2>
              </div>
            </section>

            <div className="search-controls">
              <select value={searchSubject} onChange={(event) => setSearchSubject(event.target.value)}>
                <option value="all">All subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>

              <select value={searchCategory} onChange={(event) => setSearchCategory(event.target.value)}>
                <option value="all">All categories</option>
                {allAvailableCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <select value={searchType} onChange={(event) => setSearchType(event.target.value)}>
                <option value="all">All types</option>
                {materialTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              <label className="check-wrap">
                <input type="checkbox" checked={favoritesOnly} onChange={() => setFavoritesOnly((value) => !value)} />
                Favorites only
              </label>

              <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
            </div>

            {filteredSearchResults.length ? (
              <div className="search-result-list">
                {filteredSearchResults.map((material) => (
                  <button key={material.id} type="button" className="search-result-item" onClick={() => handleOpenMaterial(material.id)}>
                    <div>
                      <strong>{material.title}</strong>
                      <small>
                        {material.fileType.toUpperCase()} · {subjects.find((subject) => subject.id === material.subjectId)?.name} · {material.category}
                      </small>
                    </div>
                    <span>{formatDate(material.dateAdded)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-card">No matching materials. Try clearing the filters or changing the keyword.</div>
            )}
          </div>
        ) : null}

        {activeNav === 'settings' ? (
          <div className="page">
            <section className="section-header">
              <div>
                <p className="eyebrow">Preferences</p>
                <h2>Settings</h2>
              </div>
            </section>

            <div className="settings-panel">
              <div className="setting-row">
                <span>Default theme</span>
                <button type="button" className="secondary-button" onClick={() => setIsDarkTheme((value) => (value === 'light' ? 'dark' : 'light'))}>{isDarkTheme === 'light' ? 'Light' : 'Dark'}</button>
              </div>
              <div className="setting-row">
                <span>Storage mode</span>
                <strong>
                  {storageMode === 'firebase'
                    ? 'Firebase Firestore'
                    : isFirebaseConfigured()
                      ? 'Firebase ready'
                      : 'Local browser storage'}
                </strong>
              </div>
              <div className="setting-row">
                <span>Cloud backend</span>
                <strong>{isFirebaseConfigured() ? 'Configured' : 'Add .env values for Firebase'}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {uploadOpen ? (
        <div className="modal-backdrop" onClick={() => setUploadOpen(false)}>
          <div className="upload-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload materials</h3>
              <button type="button" className="icon-button" onClick={() => setUploadOpen(false)}>✕</button>
            </div>

            <div className="dropzone"
              onDrop={(event) => {
                event.preventDefault()
                setUploadFiles((current) => [...current, ...Array.from(event.dataTransfer.files)])
              }}
              onDragOver={(event) => event.preventDefault()}
            >
              <input type="file" multiple onChange={handleFileChange} id="file-upload-input" hidden />
              <label htmlFor="file-upload-input" className="dropzone-label">Drop files here or browse</label>
            </div>

            <div className="upload-summary">
              {uploadFiles.length ? (
                uploadFiles.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="upload-file-row">
                    <span>{file.name}</span>
                    <button type="button" className="text-button" onClick={() => setUploadFiles((current) => current.filter((item) => item !== file))}>Remove</button>
                  </div>
                ))
              ) : (
                <div className="empty-card">No files selected yet.</div>
              )}
            </div>

            <div className="upload-fields">
              <select value={uploadForm.subjectId} onChange={(event) => {
                const nextSubject = subjects.find((subject) => subject.id === event.target.value)
                setUploadForm((current) => ({
                  ...current,
                  subjectId: event.target.value,
                  category: nextSubject?.categories.includes(current.category)
                    ? current.category
                    : nextSubject?.categories[0] ?? defaultCategories[0],
                }))
              }}>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>

              <select value={uploadForm.materialType} onChange={(event) => setUploadForm((current) => ({ ...current, materialType: event.target.value }))}>
                {materialTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              <select value={uploadForm.category} onChange={(event) => setUploadForm((current) => ({ ...current, category: event.target.value }))}>
                {uploadSubject?.categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>

              <input value={uploadForm.topic} onChange={(event) => setUploadForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Topic or chapter" />
              <textarea value={uploadForm.description} onChange={(event) => setUploadForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description (optional)" rows={3} />
              <input value={uploadForm.tags} onChange={(event) => setUploadForm((current) => ({ ...current, tags: event.target.value }))} placeholder="Tags, comma separated" />
            </div>

            {uploadError ? <div className="error-box">{uploadError}</div> : null}

            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setUploadOpen(false)}>Cancel</button>
              <button type="button" className="primary-button" disabled={uploadSaving || !uploadFiles.length} onClick={submitUpload}>
                {uploadSaving ? 'Saving...' : 'Save files'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {currentMaterial ? (
        <div className="viewer-backdrop" onClick={() => setSelectedMaterialId(null)}>
          <div className="viewer-panel" onClick={(event) => event.stopPropagation()}>
            <div className="viewer-header">
              <div>
                <p className="eyebrow">Material details</p>
                <h3>{currentMaterial.title}</h3>
              </div>
              <button type="button" className="icon-button" onClick={() => setSelectedMaterialId(null)}>✕</button>
            </div>

            <div className="viewer-content">
              <div className="viewer-preview">
                {currentMaterial.fileType === 'image' && currentMaterial.previewUrl ? (
                  <img src={currentMaterial.previewUrl} alt={currentMaterial.title} />
                ) : currentMaterial.fileType === 'pdf' && currentMaterial.previewUrl ? (
                  <iframe src={currentMaterial.previewUrl} title={currentMaterial.title} />
                ) : currentMaterial.fileType === 'text' && currentMaterial.previewUrl ? (
                  <pre>{atob(currentMaterial.previewUrl.split(',')[1] ?? '')}</pre>
                ) : (
                  <div className="preview-fallback">
                    <h4>{currentMaterial.fileName}</h4>
                    <p>{getPreviewNote(currentMaterial)}</p>
                    <button type="button" className="secondary-button" onClick={() => window.open(currentMaterial.previewUrl || '#', '_blank')}>Open or download</button>
                  </div>
                )}
              </div>

              <div className="viewer-sidebar">
                <div className="meta-list">
                  <div><span>Subject</span><strong>{subjects.find((subject) => subject.id === currentMaterial.subjectId)?.name}</strong></div>
                  <div><span>Category</span><strong>{currentMaterial.category}</strong></div>
                  <div><span>Topic</span><strong>{currentMaterial.topic}</strong></div>
                  <div><span>Type</span><strong>{currentMaterial.materialType}</strong></div>
                  <div><span>Date added</span><strong>{formatDate(currentMaterial.dateAdded)}</strong></div>
                </div>

                <div className="viewer-actions">
                  <button type="button" className="secondary-button" onClick={() => handleToggleFavorite(currentMaterial.id)}>
                    {currentMaterial.favorite ? 'Remove favorite' : 'Add to favorites'}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => handleDeleteMaterial(currentMaterial.id)}>Move to trash</button>
                </div>

                <label className="field-label">
                  Title
                  <input
                    value={currentMaterial.title}
                    onChange={(event) =>
                      setMaterials((list) =>
                        list.map((material) =>
                          material.id === currentMaterial.id
                            ? { ...material, title: event.target.value }
                            : material,
                        ),
                      )
                    }
                  />
                </label>

                <label className="field-label">
                  Category
                  <select
                    value={currentMaterial.category}
                    onChange={(event) => handleMoveMaterial(currentMaterial.id, event.target.value)}
                  >
                    {selectedSubject?.categories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>

                <label className="field-label">
                  Tags
                  <input
                    value={currentMaterial.tags.join(', ')}
                    onChange={(event) =>
                      setMaterials((list) =>
                        list.map((material) =>
                          material.id === currentMaterial.id
                            ? {
                                ...material,
                                tags: event.target.value
                                  .split(',')
                                  .map((tag) => tag.trim())
                                  .filter(Boolean),
                              }
                            : material,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
