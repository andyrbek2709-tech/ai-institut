import { create } from 'zustand'

interface CalculationState {
  selectedTemplateId: string | null
  inputs: Record<string, string | number>
  results: Record<string, any> | null
  loading: boolean
  error: string | null

  setSelectedTemplate: (id: string) => void
  setInput: (name: string, value: string | number) => void
  setInputs: (inputs: Record<string, string | number>) => void
  setResults: (results: Record<string, any>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useCalculationStore = create<CalculationState>((set) => ({
  selectedTemplateId: null,
  inputs: {},
  results: null,
  loading: false,
  error: null,

  setSelectedTemplate: (id: string) => set({ selectedTemplateId: id, results: null }),
  setInput: (name: string, value: string | number) =>
    set((state) => ({
      inputs: { ...state.inputs, [name]: value },
    })),
  setInputs: (inputs: Record<string, string | number>) => set({ inputs }),
  setResults: (results: Record<string, any>) => set({ results }),
  setLoading: (loading: boolean) => set({ loading }),
  setError: (error: string | null) => set({ error }),
  reset: () => set({
    selectedTemplateId: null,
    inputs: {},
    results: null,
    error: null,
  }),
}))
