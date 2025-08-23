
'use client'

import { covenantClient } from '@/lib/client'
import { useState, useCallback, useEffect } from 'react'
import { Todo } from '@/db/schema'


export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])

  useEffect(() => {
    const fn = async () => {
      console.log("Calling the top lvel fn of useEffect")
      const callback = await covenantClient.localListen("getTodos", null, ({ data, error, result }) => {
        if (result !== "OK") {
          console.error(error);
          return;
        }
        setTodos(data);
      });

      return callback;
    }
    const p = fn();

    return () => {
      console.log("UseEffect initialized an unsubcribe")
      p.then((c) => {
        if (c.type === "ERROR") {
          console.log(c.error);
          return;
        }

        console.log("Unsubscribing");
        c.unsubscribe();
      });
    }
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
      covenantClient.mutate("updateTodo", {
        id: id,
        text: todo.text,
        completed: !todo.completed,
      })
    }
  }, [])

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

