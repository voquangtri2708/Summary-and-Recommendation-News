const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const fileInput = document.getElementById('file-input');
const fetchUrlButton = document.getElementById('fetch-url-button');
const urlDialog = document.getElementById('url-dialog');
const urlInput = document.getElementById('url-input');
const urlOkButton = document.getElementById('url-ok-button');
const urlCloseButton = document.getElementById('url-close-button');
let previousCopiedIcon = null;

// Tự động thay đổi chiều cao của textarea
chatInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});

// Gửi tin nhắn và phản hồi từ chatbot
sendButton.addEventListener('click', showDialog);

chatInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        showDialog();
    }
});

fileInput.addEventListener('change', handleFileUpload);

fetchUrlButton.addEventListener('click', () => {
    urlDialog.style.display = 'flex';
});

urlOkButton.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (isValidURL(url)) {
        const content = await fetchContentFromURL(url);
        chatInput.value = content;
        showDialog();
        urlDialog.style.display = 'none';
        urlInput.value = '';
    } else {
        alert('Please enter a valid URL.');
    }
});

urlCloseButton.addEventListener('click', () => {
    urlDialog.style.display = 'none';
    urlInput.value = '';
});

urlInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const url = urlInput.value.trim();
        if (isValidURL(url)) {
            const content = await fetchContentFromURL(url);
            chatInput.value = content;
            showDialog();
            urlDialog.style.display = 'none';
            urlInput.value = '';
        } else {
            alert('Hãy nhập URL chính xác.');
        }
    }
});

function showDialog() {
    const message = chatInput.value.trim();
    if (message) {
        if (isClearCommand(message)) {
            clearChat();
            return;
        }

        const dialog = document.createElement('div');
        dialog.classList.add('dialog');
        dialog.innerHTML = `
            <div class="dialog-content">
                <p>Bạn muốn làm gì với đoạn văn bản này:</p>
                <button id="summary-button">Tóm tắt nội dung</button>
                <button id="suggest-button">Đề xuất bài viết</button>
            </div>
        `;
        document.body.appendChild(dialog);

        document.getElementById('summary-button').addEventListener('click', () => {
            sendMessage(message, 'Text summary');
            document.body.removeChild(dialog);
        });

        document.getElementById('suggest-button').addEventListener('click', () => {
            sendMessage(message, 'Suggest similar articles');
            document.body.removeChild(dialog);
        });
    }
}

function sendMessage(message, option) {
    if (option === 'Text summary' && message.length < 1000) {
        alert('Bài viết quá ngắn để tóm tắt.');
        return;
    }

    addMessage(message, 'user');

    setTimeout(async () => {
        let response;
        const res = await fetch('/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, option })
        });
        const data = await res.json();
        response = data.response;
        addMessage(response, 'bot', option);
    }, 500);

    chatInput.value = '';
    chatInput.style.height = 'auto';
}

async function fetchContentFromURL(url) {
    const response = await fetch('/fetch-url-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });
    const data = await response.json();
    return data.content;
}

async function summarizeText(text) {
    const response = await fetch('/summarize-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    const data = await response.json();
    return data.summary;
}

async function suggestArticles(text) {
    const response = await fetch('/suggest-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text})
    });
    const data = await response.json();
    return data.articles.map(article => `<a href="${article.url}" target="_blank">${article.title}</a>`).join('<br>');
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file && file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;
            showDialogWithContent(content);
        };
        reader.readAsText(file);
        fileInput.value = ''; // Reset the file input value
    } else {
        alert('Hãy tải file có đuôi .txt');
    }
}

function showDialogWithContent(content) {
    const dialog = document.createElement('div');
    dialog.classList.add('dialog');
    dialog.innerHTML = `
        <div class="dialog-content">
            <p>Bạn muốn làm gì với đoạn văn bản này:</p>
            <button id="summary-button">Tóm tắt nội dung</button>
            <button id="suggest-button">Đề xuất bài viết</button>
        </div>
    `;
    document.body.appendChild(dialog);

    document.getElementById('summary-button').addEventListener('click', () => {
        sendMessage(content, 'Text summary');
        document.body.removeChild(dialog);
    });

    document.getElementById('suggest-button').addEventListener('click', () => {
        sendMessage(content, 'Suggest similar articles');
        document.body.removeChild(dialog);
    });
}

// Thêm tin nhắn vào chat
function addMessage(content, sender, option = '') {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message', sender);

    if (sender === 'bot') {
        const responseDiv = document.createElement('div');
        responseDiv.classList.add('chat-response');

        const responseText = document.createElement('div');
        responseText.classList.add('chat-response-text');

        if (option === 'Suggest similar articles') {
            const similarArticlesText = document.createElement('div');
            similarArticlesText.classList.add('similar-articles-text');
            similarArticlesText.textContent = 'Các bài viết tương tự:';
            responseText.appendChild(similarArticlesText);
        }

        responseText.innerHTML += content;  // Use innerHTML to render HTML content

        const copyIcon = document.createElement('img');
        copyIcon.src = "/static/icons/content_copy_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg";
        copyIcon.classList.add('icon', 'copy-icon');
        copyIcon.title = 'Copy';
        copyIcon.addEventListener('click', () => copyToClipboard(content, copyIcon));

        responseDiv.appendChild(responseText);
        responseDiv.appendChild(copyIcon);
        messageDiv.appendChild(responseDiv);
    } else {
        messageDiv.textContent = content;
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Sao chép nội dung vào clipboard
function copyToClipboard(text, iconElement) {
    navigator.clipboard.writeText(text).then(() => {
        if (previousCopiedIcon) {
            previousCopiedIcon.src = "/static/icons/content_copy_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg";
            previousCopiedIcon.title = 'Copy';
        }
        iconElement.src = "/static/icons/check_24dp_E8EAED_FILL0_wght400_GRAD0_opsz24.svg";
        iconElement.title = 'Copied';
        previousCopiedIcon = iconElement;
    });
}

// Kiểm tra URL hợp lệ
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Kiểm tra lệnh xóa
function isClearCommand(message) {
    const lowerCaseMessage = message.toLowerCase();
    return lowerCaseMessage === 'clear' || lowerCaseMessage === 'cls';
}

// Xóa tất cả tin nhắn
function clearChat() {
    chatMessages.innerHTML = '';
    chatInput.value = '';
}
