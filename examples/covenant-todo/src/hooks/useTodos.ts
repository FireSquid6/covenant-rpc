
'use client'

import { covenantClient } from '@/lib/client'
import { useState, useCallback, useEffect } from 'react'
import { Todo } from '@/db/schema'


export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])

  useEffect(() => {
    console.log("Calling the top lvel fn of useEffect")
    const callback = covenantClient.listen("getTodos", null, ({ data, error, success }) => {
      if (!success) {
        console.error(error);
        return;
      }
      setTodos(data);
    });

    return callback;
  }, [covenantClient, setTodos])

  const createTodo = useCallback((text: string) => {
    covenantClient.mutate("makeTodo", {
      text: text,
      completed: false,
    })
  }, [setTodos])

  const updateTodo = useCallback((id: string, updates: Partial<Pick<Todo, 'text' | 'completed'>>) => {
    const todo = todos.find(t => t.id === id);

    if (!todo) {
      return;
    }

    covenantClient.mutate("updateTodo", {
      id,
      text: updates.text ?? todo.text,
      completed: updates.completed ?? todo.completed,
    }).then(r => {
      r.error
    })
  }, [todos])

  const deleteTodo = useCallback((id: string) => {
    covenantClient.mutate("deleteTodo", {
      id: id
    })
  }, [])

  const toggleTodo = useCallback((id: string) => {
    const todo = todos.find(t => t.id === id)

    if (todo) {
      const completed = !todo.completed;
      console.log("Updating todo with new completed", completed);
      covenantClient.mutate("updateTodo", {
        id: id,
        text: todo.text,
        completed: completed,
      })
    }
  }, [todos])

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

