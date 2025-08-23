
'use client'

import { covenantClient } from '@/lib/client'
import { useState, useCallback } from 'react'
import { Todo } from '@/db/schema'

const dummyTodos: Todo[] = [
  {
    id: '1',
    userId: 'user1',
    text: 'Complete project proposal',
    completed: false,
    createdAt: new Date('2024-01-15'),
    lastUpdated: new Date('2024-01-15'),
  },
  {
    id: '2',
    userId: 'user1',
    text: 'Review team performance',
    completed: true,
    createdAt: new Date('2024-01-10'),
    lastUpdated: new Date('2024-01-20'),
  },
  {
    id: '3',
    userId: 'user1',
    text: 'Update documentation',
    completed: false,
    createdAt: new Date('2024-01-20'),
    lastUpdated: new Date('2024-01-20'),
  },
  {
    id: '4',
    userId: 'user1',
    text: 'Fix authentication bug',
    completed: false,
    createdAt: new Date('2024-01-22'),
    lastUpdated: new Date('2024-01-22'),
  },
  {
    id: '5',
    userId: 'user1',
    text: 'Plan team retreat',
    completed: true,
    createdAt: new Date('2024-01-05'),
    lastUpdated: new Date('2024-01-18'),
  },
]

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(dummyTodos)

  const createTodo = useCallback((text: string) => {
    const newTodo: Todo = {
      id: Date.now().toString(),
      userId: 'user1', // This would come from session in real implementation
      text,
      completed: false,
      createdAt: new Date(),
      lastUpdated: new Date(),
    }
    setTodos(prev => [newTodo, ...prev])
    return newTodo
  }, [setTodos])

  const updateTodo = useCallback((id: string, updates: Partial<Pick<Todo, 'text' | 'completed'>>) => {
    setTodos(prev => 
      prev.map(todo => 
        todo.id === id 
          ? { ...todo, ...updates, lastUpdated: new Date() }
          : todo
      )
    )
  }, [setTodos])

  const deleteTodo = useCallback((id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id))
  }, [setTodos])

  const toggleTodo = useCallback((id: string) => {
    const todo = todos.find(t => t.id === id)

    if (todo) {
      covenantClient.mutate("updateTodo", {
        id: id,
        text: todo.text,
        completed: !todo.completed,
      })
    }
  }, [todos, updateTodo])

  const completedTodos = todos.filter(todo => todo.completed)
  const pendingTodos = todos.filter(todo => !todo.completed)

  return {
    todos,
    completedTodos,
    pendingTodos,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
  }
}

