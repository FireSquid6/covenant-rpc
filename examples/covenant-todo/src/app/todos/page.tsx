'use client'

import { useState } from 'react'
import { useTodos } from '@/hooks/useTodos'
import { Todo } from '@/db/schema'

export default function TodosPage() {
  const { todos, completedTodos, pendingTodos, createTodo, updateTodo, deleteTodo, toggleTodo } = useTodos()
  const [newTodoText, setNewTodoText] = useState('')
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [editText, setEditText] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')

  const handleCreateTodo = (e: React.FormEvent) => {
    e.preventDefault()
    if (newTodoText.trim()) {
      createTodo(newTodoText.trim())
      setNewTodoText('')
    }
  }

  const handleStartEdit = (todo: Todo) => {
    setEditingTodo(todo)
    setEditText(todo.text)
  }

  const handleSaveEdit = () => {
    if (editingTodo && editText.trim()) {
      updateTodo(editingTodo.id, { text: editText.trim() })
      setEditingTodo(null)
      setEditText('')
    }
  }

  const handleCancelEdit = () => {
    setEditingTodo(null)
    setEditText('')
  }

  const filteredTodos = filter === 'all' ? todos : filter === 'pending' ? pendingTodos : completedTodos

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Todos</h1>
        <div className="stats shadow">
          <div className="stat">
            <div className="stat-title">Total</div>
            <div className="stat-value">{todos.length}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Pending</div>
            <div className="stat-value text-warning">{pendingTodos.length}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Completed</div>
            <div className="stat-value text-success">{completedTodos.length}</div>
          </div>
        </div>
      </div>

      {/* Create New Todo */}
      <div className="card bg-base-200 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title">Add New Todo</h2>
          <form onSubmit={handleCreateTodo} className="flex gap-2">
            <input
              type="text"
              placeholder="What needs to be done?"
              className="input input-bordered flex-1"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              Add Todo
            </button>
          </form>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs tabs-boxed mb-6">
        <a 
          className={`tab ${filter === 'all' ? 'tab-active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({todos.length})
        </a>
        <a 
          className={`tab ${filter === 'pending' ? 'tab-active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending ({pendingTodos.length})
        </a>
        <a 
          className={`tab ${filter === 'completed' ? 'tab-active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed ({completedTodos.length})
        </a>
      </div>

      {/* Todo List */}
      <div className="space-y-3">
        {filteredTodos.length === 0 ? (
          <div className="card bg-base-200 shadow-sm">
            <div className="card-body text-center py-8">
              <p className="text-base-content/60">
                {filter === 'all' 
                  ? 'No todos yet. Create your first one above!' 
                  : filter === 'pending'
                  ? 'No pending todos. Great job staying on top of things!'
                  : 'No completed todos yet. Start checking some off!'
                }
              </p>
            </div>
          </div>
        ) : (
          filteredTodos.map((todo) => (
            <div key={todo.id} className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body p-4">
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id)}
                  />

                  {/* Todo Text */}
                  <div className="flex-1">
                    {editingTodo?.id === todo.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="input input-bordered input-sm flex-1"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit()
                            if (e.key === 'Escape') handleCancelEdit()
                          }}
                          autoFocus
                        />
                        <button onClick={handleSaveEdit} className="btn btn-success btn-sm">
                          Save
                        </button>
                        <button onClick={handleCancelEdit} className="btn btn-ghost btn-sm">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className={`cursor-pointer ${todo.completed ? 'line-through text-base-content/50' : ''}`}>
                        <p className="font-medium">{todo.text}</p>
                        <p className="text-sm text-base-content/60">
                          Created: {new Date(todo.createdAt).toLocaleDateString()}
                          {new Date(todo.lastUpdated).getTime() !== new Date(todo.createdAt).getTime() && 
                            ` • Updated: ${new Date(todo.lastUpdated).toLocaleDateString()}`
                          }
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {editingTodo?.id !== todo.id && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleStartEdit(todo)}
                        className="btn btn-ghost btn-sm btn-square"
                        title="Edit todo"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="btn btn-ghost btn-sm btn-square text-error"
                        title="Delete todo"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
