let notes = [];
let currentNote = null;
let isEditing = false;

// IndexedDB helpers
const DB_NAME = 'RichNotesDB';
const DB_VERSION = 1;
const STORE_NAME = 'notes';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function(e) {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveNotesToDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        // Limpa antes de salvar para evitar duplicidade
        await new Promise((resolve, reject) => {
            const clearRequest = store.clear();
            clearRequest.onsuccess = resolve;
            clearRequest.onerror = reject;
        });

        // Salva todas as notas
        for (const note of notes) {
            await new Promise((resolve, reject) => {
                const putRequest = store.put(note);
                putRequest.onsuccess = resolve;
                putRequest.onerror = reject;
            });
        }

        tx.oncomplete = () => {
            db.close();
            console.log('Notas salvas no IndexedDB:', notes.length);
        };
    } catch (error) {
        console.error('Erro ao salvar no IndexedDB:', error);
        // Fallback: salva no localStorage se IndexedDB falhar
        try {
            localStorage.setItem('richNotes', JSON.stringify(notes));
            console.log('Fallback: salvo no localStorage');
        } catch (e) {
            console.error('Erro também no localStorage:', e);
        }
    }
}

async function loadNotesFromDB() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        
        const request = store.getAll();
        request.onsuccess = () => {
            notes = request.result || [];
            sortNotes();
            renderNotes();
            console.log('Notas carregadas do IndexedDB:', notes.length);
        };
        tx.oncomplete = () => db.close();
    } catch (error) {
        console.error('Erro ao carregar do IndexedDB:', error);
        // Fallback: tenta carregar do localStorage
        try {
            const stored = localStorage.getItem('richNotes');
            if (stored) {
                notes = JSON.parse(stored);
                sortNotes();
                renderNotes();
                console.log('Fallback: carregado do localStorage:', notes.length);
            } else {
                notes = [];
                renderNotes();
            }
        } catch (e) {
            console.error('Erro também no localStorage:', e);
            notes = [];
            renderNotes();
        }
    }
}

// Ordena as notas por data de atualização (mais recentes primeiro)
function sortNotes() {
    notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// Substitui saveNotes pelo IndexedDB
function saveNotes() {
    sortNotes();
    saveNotesToDB();
}

// Exportação e importação continuam iguais
function exportNotes() {
    if (notes.length === 0) {
        alert('Não há notas para exportar!');
        return;
    }

    const dataStr = JSON.stringify(notes, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `minhas-notas-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`Backup criado com ${notes.length} notas! Salve o arquivo em local seguro.`);
}

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
                'Clique OK para SUBSTITUIR todas as notas atuais\n' +
                'Clique Cancelar para ADICIONAR às notas existentes'
            );

            if (action) {
                // Substituir
                notes = importedNotes;
            } else {
                // Adicionar (evitar IDs duplicados)
                const maxId = Math.max(...notes.map(n => n.id), 0);
                const adjustedNotes = importedNotes.map((note, index) => ({
                    ...note,
                    id: maxId + index + 1
                }));
                notes = [...adjustedNotes, ...notes];
            }

            saveNotes();
            loadNotesFromDB(); // <-- sincroniza com IndexedDB
            renderNotes();

            // Limpar seleção atual se necessário
            if (currentNote && !notes.find(n => n.id === currentNote.id)) {
                currentNote = null;
                showEmptyState();
            }

            alert('Notas importadas com sucesso!');

        } catch (error) {
            alert('Erro ao importar arquivo. Verifique se é um backup válido.');
        }
    };
    reader.readAsText(file);

    // Limpar input
    event.target.value = '';
}

function createNote() {
    if (isEditing && !confirm('Deseja salvar as alterações antes de criar uma nova nota?')) {
        return;
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
    // Pequeno delay para garantir que a nota foi selecionada antes de editar
    setTimeout(() => editNote(), 100);
}

// Função auxiliar para escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderNotes(filtered = null) {
    const list = document.getElementById('notesList');
    const toRender = filtered || notes;

    if (toRender.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>Nenhuma nota encontrada</p></div>';
        return;
    }

    // Limpa a lista antes de recriar
    list.innerHTML = '';

    toRender.forEach(note => {
        const noteElement = document.createElement('div');
        noteElement.className = `note-item ${currentNote?.id === note.id ? 'active' : ''}`;
        
        // Usa addEventListener em vez de onclick inline para evitar problemas com caracteres especiais
        noteElement.addEventListener('click', () => selectNoteById(note.id));

        // Cria o conteúdo de forma segura
        const noteHeader = document.createElement('div');
        noteHeader.className = 'note-header';

        const noteTitle = document.createElement('div');
        noteTitle.className = 'note-title';
        noteTitle.textContent = note.title; // textContent é mais seguro que innerHTML

        const noteActions = document.createElement('div');
        noteActions.className = 'note-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-icon';
        editBtn.title = 'Editar';
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editNoteFromList(note.id);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-icon delete';
        deleteBtn.title = 'Excluir';
        deleteBtn.textContent = '🗑️';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNote(note.id);
        });

        const noteContent = document.createElement('p');
        noteContent.className = 'note-content';
        // Remove HTML tags e pega apenas o texto, tratando casos especiais
        const cleanContent = note.content.replace(/<[^>]*>/g, '').trim();
        noteContent.textContent = cleanContent.substring(0, 100) || 'Sem conteúdo';

        const noteDate = document.createElement('div');
        noteDate.className = 'note-date';
        noteDate.textContent = formatDate(note.updatedAt);

        // Monta a estrutura
        noteActions.appendChild(editBtn);
        noteActions.appendChild(deleteBtn);
        noteHeader.appendChild(noteTitle);
        noteHeader.appendChild(noteActions);
        
        noteElement.appendChild(noteHeader);
        noteElement.appendChild(noteContent);
        noteElement.appendChild(noteDate);
        
        list.appendChild(noteElement);
    });
}

// Nova função para selecionar nota por ID com tratamento de erro
function selectNoteById(id) {
    try {
        if (isEditing && !confirm('Deseja salvar as alterações antes de trocar de nota?')) {
            return;
        }

        const note = notes.find(n => n.id === id);
        if (note) {
            console.log('Selecionando nota:', note.title);
            selectNote(note);
        } else {
            console.error('Nota não encontrada com ID:', id);
        }
    } catch (error) {
        console.error('Erro ao selecionar nota:', error);
        alert('Erro ao abrir a nota.');
    }
}

function selectNote(note) {
    currentNote = note;
    showContent();
}

function showContent() {
    if (!currentNote) return;

    try {
        // Primeiro cancela qualquer edição em andamento
        cancelEdit();

        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('contentHeader').classList.remove('hidden');
        document.getElementById('contentDisplay').classList.remove('hidden');

        document.getElementById('displayTitle').textContent = currentNote.title;
        document.getElementById('contentDate').textContent = `Modificado: ${formatDate(currentNote.updatedAt)}`;
        
        // Trata o conteúdo de forma mais segura
        const displayElement = document.getElementById('contentDisplay');
        if (currentNote.content && currentNote.content.trim() !== '') {
            displayElement.innerHTML = currentNote.content;
        } else {
            displayElement.innerHTML = '<p style="color: #9ca3af; font-style: italic;">Esta nota está vazia</p>';
        }

        renderNotes();
        console.log('Conteúdo exibido para:', currentNote.title);
    } catch (error) {
        console.error('Erro ao mostrar conteúdo:', error);
        alert('Erro ao exibir a nota.');
    }
}

function showEmptyState() {
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('contentHeader').classList.add('hidden');
    document.getElementById('contentDisplay').classList.add('hidden');
    cancelEdit();
}

function editNote() {
    if (!currentNote) return;

    isEditing = true;
    document.getElementById('editTitle').value = currentNote.title;
    document.getElementById('contentEditor').innerHTML = currentNote.content;

    // Mostrar elementos de edição
    document.getElementById('editTitle').classList.remove('hidden');
    document.getElementById('displayTitle').classList.add('hidden');
    document.getElementById('contentEditor').classList.remove('hidden');
    document.getElementById('contentEditor').contentEditable = true;
    document.getElementById('contentDisplay').classList.add('hidden');
    document.getElementById('toolbar').classList.remove('hidden');

    document.getElementById('editBtn').classList.add('hidden');
    document.getElementById('saveBtn').classList.remove('hidden');
    document.getElementById('cancelBtn').classList.remove('hidden');

    document.getElementById('contentEditor').focus();
}

function editNoteFromList(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        selectNote(note);
        setTimeout(() => editNote(), 100);
    }
}

function saveNote() {
    if (!currentNote) return;

    const title = document.getElementById('editTitle').value.trim() || 'Nova Nota';
    let content = document.getElementById('contentEditor').innerHTML;
    
    // Limpa e sanitiza o conteúdo para evitar problemas
    content = content.replace(/&nbsp;/g, ' '); // Remove &nbsp;
    content = content.replace(/\u00A0/g, ' '); // Remove non-breaking spaces
    content = content.trim();

    const index = notes.findIndex(n => n.id === currentNote.id);
    if (index !== -1) {
        try {
            notes[index] = {
                ...currentNote,
                title: title,
                content: content,
                updatedAt: new Date().toISOString()
            };
            currentNote = notes[index];
            saveNotes();
            renderNotes();
            // Chama showContent para atualizar a visualização
            showContent();
            console.log('Nota salva com sucesso:', currentNote.title);
        } catch (error) {
            console.error('Erro ao salvar nota:', error);
            alert('Erro ao salvar a nota. Tente novamente.');
        }
    }
}

function cancelEdit() {
    isEditing = false;

    document.getElementById('editTitle').classList.add('hidden');
    document.getElementById('displayTitle').classList.remove('hidden');
    document.getElementById('contentEditor').classList.add('hidden');
    document.getElementById('contentEditor').contentEditable = false;
    
    // Só mostra o display se há uma nota atual
    if (currentNote) {
        document.getElementById('contentDisplay').classList.remove('hidden');
    }
    
    document.getElementById('toolbar').classList.add('hidden');

    document.getElementById('editBtn').classList.remove('hidden');
    document.getElementById('saveBtn').classList.add('hidden');
    document.getElementById('cancelBtn').classList.add('hidden');
}

function deleteNote(id) {
    if (!confirm('Excluir esta nota?')) return;

    notes = notes.filter(n => n.id !== id);
    saveNotes();
    renderNotes();

    if (currentNote?.id === id) {
        currentNote = null;
        showEmptyState();
    }
}

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

function formatText(command, value = null) {
    if (command === 'createLink') {
        const url = prompt('Digite a URL:');
        if (url) document.execCommand(command, false, url);
    } else if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
        const selection = window.getSelection();

        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);

            if (!range.collapsed) {
                const selectedText = range.toString();
                const listType = command === 'insertUnorderedList' ? 'ul' : 'ol';
                const listHTML = `<${listType}><li>${selectedText}</li></${listType}>`;

                range.deleteContents();
                const temp = document.createElement('div');
                temp.innerHTML = listHTML;
                const listNode = temp.firstChild;
                range.insertNode(listNode);

                const newRange = document.createRange();
                newRange.selectNodeContents(listNode.firstChild);
                newRange.collapse(false);
                selection.removeAllRanges();
                selection.addRange(newRange);
            } else {
                document.execCommand('outdent');
                document.execCommand('outdent');
                document.execCommand('outdent');

                const listType = command === 'insertUnorderedList' ? 'ul' : 'ol';
                const listHTML = `<${listType}><li></li></${listType}>`;
                document.execCommand('insertHTML', false, listHTML);
            }
        }
    } else {
        document.execCommand(command, false, value);
    }
    document.getElementById('contentEditor').focus();
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Inicialização: carrega notas do IndexedDB
window.onload = function() {
    loadNotesFromDB();
};

// Atualizar botões da toolbar baseado na seleção
document.addEventListener('DOMContentLoaded', function() {
    const contentEditor = document.getElementById('contentEditor');
    if (contentEditor) {
        contentEditor.addEventListener('keyup', updateToolbar);
        contentEditor.addEventListener('mouseup', updateToolbar);
        contentEditor.addEventListener('keydown', handleKeyDown);
    }
});

function updateToolbar() {
    const commands = ['bold', 'italic', 'underline'];
    commands.forEach(cmd => {
        const btn = document.querySelector(`[onclick*="${cmd}"]`);
        if (btn) {
            btn.classList.toggle('active', document.queryCommandState(cmd));
        }
    });
}

function handleKeyDown(e) {
    if (e.key === 'Enter') {
        const selection = window.getSelection();
        const node = selection.anchorNode;
        if (node && node.parentElement) {
            const li = node.parentElement.closest('li');
            if (li && li.textContent.trim() === '') {
                e.preventDefault();
                document.execCommand('outdent');
                return;
            }
        }
    }
}
