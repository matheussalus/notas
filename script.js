let notes = JSON.parse(localStorage.getItem('rich-notes') || '[]');
let currentNote = null;
let isEditing = false;

function saveNotes() {
    localStorage.setItem('rich-notes', JSON.stringify(notes));
}

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
            renderNotes();

            // Limpar seleção atual se necessário
            if (currentNote && !notes.find(n => n.id === currentNote.id)) {
                currentNote = null;
                document.getElementById('emptyState').classList.remove('hidden');
                document.getElementById('contentHeader').classList.add('hidden');
                document.getElementById('contentDisplay').classList.add('hidden');
                cancelEdit();
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
    if (isEditing && !confirm('Deseja salvar as alterações?')) return;

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
    editNote();
}

function renderNotes(filtered = null) {
    const list = document.getElementById('notesList');
    const toRender = filtered || notes;

    if (toRender.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>Nenhuma nota encontrada</p></div>';
        return;
    }

    list.innerHTML = toRender.map(note => `
        <div class="note-item ${currentNote?.id === note.id ? 'active' : ''}" onclick="selectNote(${JSON.stringify(note).replace(/"/g, '&quot;')})">
            <div class="note-header">
                <div class="note-title">${note.title}</div>
                <div class="note-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); editNoteFromList(${note.id})">✏️</button>
                    <button class="btn-icon delete" onclick="event.stopPropagation(); deleteNote(${note.id})">🗑️</button>
                </div>
            </div>
            <p class="note-content">${note.content.replace(/<[^>]*>/g, '').substring(0, 100) || 'Sem conteúdo'}</p>
            <div class="note-date">${formatDate(note.updatedAt)}</div>
        </div>
    `).join('');
}

function selectNote(note) {
    if (isEditing && !confirm('Deseja salvar as alterações?')) return;

    currentNote = note;
    showContent();
}

function showContent() {
    if (!currentNote) return;

    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('contentHeader').classList.remove('hidden');
    document.getElementById('contentDisplay').classList.remove('hidden');

    document.getElementById('displayTitle').textContent = currentNote.title;
    document.getElementById('contentDate').textContent = `Modificado: ${formatDate(currentNote.updatedAt)}`;
    document.getElementById('contentDisplay').innerHTML = currentNote.content || '<p style="color: #9ca3af; font-style: italic;">Esta nota está vazia</p>';

    renderNotes();
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
        editNote();
    }
}

function saveNote() {
    if (!currentNote) return;

    const title = document.getElementById('editTitle').value;
    const content = document.getElementById('contentEditor').innerHTML;

    const index = notes.findIndex(n => n.id === currentNote.id);
    if (index !== -1) {
        notes[index] = {
            ...currentNote,
            title: title,
            content: content,
            updatedAt: new Date().toISOString()
        };
        currentNote = notes[index];
        saveNotes();
        renderNotes();
        cancelEdit();
        showContent();
    }
}

function cancelEdit() {
    isEditing = false;

    document.getElementById('editTitle').classList.add('hidden');
    document.getElementById('displayTitle').classList.remove('hidden');
    document.getElementById('contentEditor').classList.add('hidden');
    document.getElementById('contentEditor').contentEditable = false;
    document.getElementById('contentDisplay').classList.remove('hidden');
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
        document.getElementById('emptyState').classList.remove('hidden');
        document.getElementById('contentHeader').classList.add('hidden');
        document.getElementById('contentDisplay').classList.add('hidden');
        cancelEdit();
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

// Inicialização
renderNotes();

// Atualizar botões da toolbar baseado na seleção
document.getElementById('contentEditor').addEventListener('keyup', updateToolbar);
document.getElementById('contentEditor').addEventListener('mouseup', updateToolbar);
document.getElementById('contentEditor').addEventListener('keydown', handleKeyDown);

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
