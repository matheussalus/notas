// Variáveis globais
let notes = [];
let currentNote = null;
let isEditing = false;

// Função para alternar tema
function toggleTheme() {
    const html = document.documentElement;
    const themeBtn = document.getElementById('themeBtn');
    
    if (html.getAttribute('data-theme') === 'dark') {
        html.setAttribute('data-theme', 'light');
        themeBtn.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        themeBtn.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    }
}

// Inicializar tema
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const html = document.documentElement;
    const themeBtn = document.getElementById('themeBtn');
    
    html.setAttribute('data-theme', savedTheme);
    themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

// Salvar notas no localStorage
function saveNotes() {
    try {
        localStorage.setItem('richNotes', JSON.stringify(notes));
        console.log('Notas salvas:', notes.length);
    } catch (error) {
        console.error('Erro ao salvar:', error);
        alert('Erro ao salvar as notas!');
    }
}

// Carregar notas do localStorage
function loadNotes() {
    try {
        const stored = localStorage.getItem('richNotes');
        if (stored) {
            notes = JSON.parse(stored);
            console.log('Notas carregadas:', notes.length);
        }
        sortNotes();
        renderNotes();
    } catch (error) {
        console.error('Erro ao carregar:', error);
        notes = [];
        renderNotes();
    }
}

// Ordenar notas por data (mais recentes primeiro)
function sortNotes() {
    notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// Criar nova nota
function createNote() {
    if (isEditing) {
        if (!confirm('Deseja salvar as alterações antes de criar uma nova nota?')) {
            return;
        }
        saveNote();
    }

    const note = {
        id: Date.now(),
        title: 'Nova Nota',
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    notes.unshift(note);
    saveNotes();
    renderNotes();
    selectNote(note);
    setTimeout(() => editNote(), 100);
}

// Renderizar lista de notas
function renderNotes(filtered = null) {
    const list = document.getElementById('notesList');
    const toRender = filtered || notes;

    if (toRender.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="padding: 2rem; text-align: center;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">Nenhuma nota encontrada</p>
                <button class="btn-primary" onclick="createNote()">✨ Criar primeira nota</button>
            </div>
        `;
        return;
    }

    list.innerHTML = '';

    toRender.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = `note-item ${currentNote?.id === note.id ? 'active' : ''}`;
        
        noteElement.addEventListener('click', () => selectNote(note));

        // Conteúdo limpo para preview
        const cleanContent = note.content.replace(/<[^>]*>/g, '').trim();
        const preview = cleanContent.length > 80 ? cleanContent.substring(0, 80) + '...' : cleanContent;

        noteElement.innerHTML = `
            <div class="note-header">
                <div class="note-title">${escapeHtml(note.title)}</div>
                <div class="note-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); editNoteFromList(${note.id})" title="Editar">✏️</button>
                    <button class="btn-icon delete" onclick="event.stopPropagation(); deleteNote(${note.id})" title="Excluir">🗑️</button>
                </div>
            </div>
            <div class="note-content">${preview || 'Nota vazia'}</div>
            <div class="note-date">${formatDate(note.updatedAt)}</div>
        `;
        
        list.appendChild(noteElement);
    });
}

// Selecionar nota
function selectNote(note) {
    if (isEditing) {
        if (!confirm('Deseja salvar as alterações antes de trocar de nota?')) {
            return;
        }
        saveNote();
    }

    currentNote = note;
    showContent();
    renderNotes(); // Atualiza a lista para mostrar a nota ativa
}

// Mostrar conteúdo da nota
function showContent() {
    if (!currentNote) return;

    cancelEdit(); // Garantir que não está em modo edição

    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('contentHeader').classList.remove('hidden');
    document.getElementById('contentDisplay').classList.remove('hidden');

    document.getElementById('displayTitle').textContent = currentNote.title;
    document.getElementById('contentDate').textContent = `Modificado: ${formatDate(currentNote.updatedAt)}`;
    
    updateWordCount();
    
    const displayElement = document.getElementById('contentDisplay');
    if (currentNote.content && currentNote.content.trim() !== '') {
        displayElement.innerHTML = currentNote.content;
    } else {
        displayElement.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Esta nota está vazia. Clique em "Editar" para começar a escrever.</p>';
    }
}

// Mostrar estado vazio
function showEmptyState() {
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('contentHeader').classList.add('hidden');
    document.getElementById('contentDisplay').classList.add('hidden');
    cancelEdit();
}

// Editar nota
function editNote() {
    if (!currentNote) return;

    isEditing = true;
    
    // Mostrar campos de edição
    document.getElementById('editTitle').value = currentNote.title;
    document.getElementById('contentEditor').innerHTML = currentNote.content;

    // Trocar visibilidade dos elementos
    document.getElementById('editTitle').classList.remove('hidden');
    document.getElementById('displayTitle').classList.add('hidden');
    document.getElementById('contentEditor').classList.remove('hidden');
    document.getElementById('contentEditor').contentEditable = true;
    document.getElementById('contentDisplay').classList.add('hidden');
    document.getElementById('toolbar').classList.remove('hidden');

    // Trocar botões
    document.getElementById('editBtn').classList.add('hidden');
    document.getElementById('saveBtn').classList.remove('hidden');
    document.getElementById('cancelBtn').classList.remove('hidden');

    // Focar no editor
    document.getElementById('contentEditor').focus();
    
    console.log('Modo edição ativado para:', currentNote.title);
}

// Editar nota da lista
function editNoteFromList(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        selectNote(note);
        setTimeout(() => editNote(), 100);
    }
}

// Salvar nota - VERSÃO CORRIGIDA
function saveNote() {
    if (!currentNote || !isEditing) return;

    const title = document.getElementById('editTitle').value.trim() || 'Nota sem título';
    const content = document.getElementById('contentEditor').innerHTML.trim();

    // Atualizar a nota atual
    currentNote.title = title;
    currentNote.content = content;
    currentNote.updatedAt = new Date().toISOString();

    // Remover a nota da posição atual no array
    notes = notes.filter(n => n.id !== currentNote.id);
    
    // Adicionar a nota atualizada no início do array
    notes.unshift(currentNote);
    
    // Salvar e re-renderizar
    saveNotes();
    renderNotes();
    showContent();
    
    console.log('Nota salva e movida para o topo:', currentNote.title);
    showNotification('Nota salva com sucesso!', 'success');
}

// Cancelar edição
function cancelEdit() {
    isEditing = false;

    // Ocultar campos de edição
    document.getElementById('editTitle').classList.add('hidden');
    document.getElementById('displayTitle').classList.remove('hidden');
    document.getElementById('contentEditor').classList.add('hidden');
    document.getElementById('contentEditor').contentEditable = false;
    
    if (currentNote) {
        document.getElementById('contentDisplay').classList.remove('hidden');
    }
    
    document.getElementById('toolbar').classList.add('hidden');

    // Trocar botões
    document.getElementById('editBtn').classList.remove('hidden');
    document.getElementById('saveBtn').classList.add('hidden');
    document.getElementById('cancelBtn').classList.add('hidden');
}

// Excluir nota
function deleteNote(id) {
    if (!confirm('Tem certeza que deseja excluir esta nota?')) return;

    notes = notes.filter(n => n.id !== id);
    saveNotes();
    renderNotes();

    if (currentNote?.id === id) {
        currentNote = null;
        showEmptyState();
    }
    
    showNotification('Nota excluída!', 'success');
}

// Buscar notas
function searchNotes(term) {
    if (!term.trim()) {
        renderNotes();
        return;
    }

    const filtered = notes.filter(note =>
        note.title.toLowerCase().includes(term.toLowerCase()) ||
        note.content.toLowerCase().includes(term.toLowerCase())
    );

    renderNotes(filtered);
}

// Formatação de texto
function formatText(command, value = null) {
    if (!isEditing) return;

    if (command === 'createLink') {
        const url = prompt('Digite a URL:', 'https://');
        if (url && url !== 'https://') {
            document.execCommand(command, false, url);
        }
    } else {
        document.execCommand(command, false, value);
    }
    
    document.getElementById('contentEditor').focus();
    updateToolbar();
}

// Atualizar toolbar
function updateToolbar() {
    if (!isEditing) return;
    
    const commands = ['bold', 'italic', 'underline'];
    commands.forEach(cmd => {
        const btn = document.querySelector(`[onclick*="${cmd}"]`);
        if (btn) {
            if (document.queryCommandState(cmd)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

// Contar palavras e caracteres
function updateWordCount() {
    if (!currentNote) return;
    
    const content = currentNote.content || '';
    const text = content.replace(/<[^>]*>/g, '').trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = text.length;
    
    document.getElementById('wordCount').textContent = `${words} palavras`;
    document.getElementById('charCount').textContent = `${chars} caracteres`;
}

// Exportar notas
function exportNotes() {
    if (notes.length === 0) {
        showNotification('Não há notas para exportar!', 'warning');
        return;
    }

    const dataStr = JSON.stringify(notes, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `backup-notas-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification(`Backup criado com ${notes.length} notas!`, 'success');
}

// Importar notas
function importNotes() {
    document.getElementById('fileInput').click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedNotes = JSON.parse(e.target.result);

            if (!Array.isArray(importedNotes)) {
                throw new Error('Formato inválido');
            }

            const action = confirm(
                `Arquivo contém ${importedNotes.length} notas.\n\n` +
                'OK = SUBSTITUIR todas as notas\n' +
                'Cancelar = ADICIONAR às notas existentes'
            );

            if (action) {
                notes = importedNotes;
            } else {
                const maxId = Math.max(...notes.map(n => n.id), 0);
                const adjustedNotes = importedNotes.map((note, index) => ({
                    ...note,
                    id: maxId + index + 1
                }));
                notes = [...notes, ...adjustedNotes];
            }

            saveNotes();
            sortNotes(); // Garantir ordenação correta após importação
            renderNotes();

            if (currentNote && !notes.find(n => n.id === currentNote.id)) {
                currentNote = null;
                showEmptyState();
            }

            showNotification('Notas importadas com sucesso!', 'success');

        } catch (error) {
            showNotification('Erro ao importar arquivo!', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// Funções auxiliares
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR') + ' às ' + 
           date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Sistema de notificações
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(-100%);
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        color: white;
        font-weight: 500;
        z-index: 1000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: transform 0.3s ease;
        text-align: center;
    `;
    
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#10b981';
            break;
        case 'error':
            notification.style.backgroundColor = '#ef4444';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f59e0b';
            break;
        default:
            notification.style.backgroundColor = '#3b82f6';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(0)';
    }, 100);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(-100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Atalhos de teclado
function handleKeyDown(e) {
    if (!isEditing) return;

    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'b':
                e.preventDefault();
                formatText('bold');
                break;
            case 'i':
                e.preventDefault();
                formatText('italic');
                break;
            case 'u':
                e.preventDefault();
                formatText('underline');
                break;
            case 's':
                e.preventDefault();
                saveNote();
                break;
        }
    }
}

// Inicialização
window.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, inicializando...');
    
    initTheme();
    loadNotes();
    
    // Event listeners
    const contentEditor = document.getElementById('contentEditor');
    if (contentEditor) {
        contentEditor.addEventListener('keyup', updateToolbar);
        contentEditor.addEventListener('mouseup', updateToolbar);
        contentEditor.addEventListener('keydown', handleKeyDown);
        contentEditor.addEventListener('input', () => {
            if (currentNote && isEditing) {
                // Auto-update word count durante edição
                const tempContent = document.getElementById('contentEditor').innerHTML;
                const text = tempContent.replace(/<[^>]*>/g, '').trim();
                const words = text ? text.split(/\s+/).length : 0;
                const chars = text.length;
                
                document.getElementById('wordCount').textContent = `${words} palavras`;
                document.getElementById('charCount').textContent = `${chars} caracteres`;
            }
        });
    }
    
    // Auto-save a cada 30 segundos
    setInterval(() => {
        if (isEditing && currentNote) {
            console.log('Auto-save...');
            saveNote();
        }
    }, 30000);
    
    console.log('Inicialização completa!');
});

console.log('Script carregado!');
