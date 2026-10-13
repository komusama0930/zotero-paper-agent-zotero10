# SPDX-License-Identifier: AGPL-3.0-or-later
# Unofficial modifications by komusama0930, 2026-10-13; see NOTICE.
from pathlib import Path


def patch(text):
    helpers = (Path(__file__).resolve().parent.parent/'assets/stream.js').read_text()
    marker = '  // src/modules/ui/dialog/dialogui.ts'
    text = text.replace(marker, helpers+'\n'+marker, 1)
    start = text.index('      const streamCallback = (response) => {')
    end = text.index('      addon.data.zoteroPaperAgentApi.completion({', start)
    text = text[:start]+'''      const streamRenderer = paperAgentCreateStreamRenderer(
        agentMessageTextItemContentTextContainer,
        agentMessageTextItemThinkingTextContainer,
        agentMessageTextItemThinking,
        messageContainer
      );
      const streamCallback = streamRenderer.push;
'''+text[end:]
    marker = '      }).then(async (response) => {\n        console.log("response", response);'
    if text.count(marker) != 1: raise ValueError('Stream completion target mismatch')
    text = text.replace(marker, '      }).then(async (response) => {\n        streamRenderer.finish();', 1)
    marker = '''        addon.data.zoteroPaperAgentApi.isStreamResponseStoped = false;
      });
      messageContainer.appendChild(userMessageItem);'''
    if text.count(marker) != 1: raise ValueError('Stream rejection target mismatch')
    text = text.replace(marker, '''        addon.data.zoteroPaperAgentApi.isStreamResponseStoped = false;
      }).catch(error => {
        streamRenderer.finish();
        toggleSendStopButton(chatUI, false);
        agentMessageTextItemContentTextContainer.appendChild(
          agentMessageTextItemContentTextContainer.ownerDocument.createTextNode("\\n请求失败：" + (error.message || error))
        );
        Zotero.logError(error);
      });
      messageContainer.appendChild(userMessageItem);''', 1)
    return text
