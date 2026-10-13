# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications maintained by komusama0930; 2026-10-13. See NOTICE.
def patch(text):
    start = text.index('  var md = markdownit({')
    end = text.index('  function renderMarkdownWithKeywords(', start)
    text = text[:start]+'''  var md = markdownit({
    breaks: true,
    xhtmlOut: true,
    html: false,
    linkify: true,
    typographer: true
  });
  md.renderer.rules.table_open = () => '<div class="paper-agent-markdown-table" role="region" aria-label="表格，可横向滚动" tabindex="0"><table>\\n';
  md.renderer.rules.table_close = () => '</table></div>\\n';
'''+text[end:]
    before = '            const keywordHighlightedContent = renderKeywordHighlight(\n              messageItem.content,\n              keywordSearchItem.keyword,\n              keywordSearchItem.chat_session_id,\n              keywordSearchItem.message_id\n            );'
    after = '            const keywordHighlightedContent = renderMarkdownWithKeywords(messageItem.content, [keywordSearchItem.keyword]);'
    if text.count(before) != 2: raise ValueError('History Markdown highlight target mismatch')
    index = text.rindex(before)
    text = text[:index] + after + text[index + len(before):]
    before = '            messageTextContainer2.innerHTML = keywordHighlightedContent;\n            if (messageItem.role == "assistant") {\n              messageTextItemContentTextContainer.innerHTML = renderMarkdownWithKeywords(keywordHighlightedContent);\n            }'
    if text.count(before) != 1: raise ValueError('History Markdown container target mismatch')
    text = text.replace(before, '            messageTextItemContentTextContainer.innerHTML = keywordHighlightedContent;', 1)
    return text
