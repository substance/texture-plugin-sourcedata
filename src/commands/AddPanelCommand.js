import { Command } from 'substance'

export default class AddPanelCommand extends Command {
  getCommandState () {
    return { disabled: false }
  }

  execute (params, context) {
    const editor = context.editorSession.getRootComponent()
    const selectionState = params.selectionState
    const node = selectionState.node
    if (editor) {
      editor.send('requestFileSelect', { fileType: 'image/*', multiple: false }).then(files => {
        if (files.length > 0) {
          let currentPanelId
          if (node && node.type === 'panel') {
            currentPanelId = node.id
          }
          context.api.insertPanel(files[0], currentPanelId)
        }
      })
    }
  }
}
