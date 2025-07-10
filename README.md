# Say

Say is a modern voice transcription app that transforms your voice into text using advanced machine learning, right in your browser. Built with React and powered by Whisper, T5 and Transformers.js, it offers a seamless experience for recording, transcribing, and managing your spoken notes.

![](https://say.addy.ie/screenshot-01@1x.jpg)

## ✨ Features

- 🎙️ **Browser-based Recording**: Record audio directly in your browser with a clean, intuitive interface
- 🤖 **ML-Powered Transcription**: Convert speech to text using state-of-the-art machine learning, running entirely in your browser
- 🔄 **Dify Workflow Integration**: Process audio through custom AI workflows using Dify's powerful platform
- 📝 **Rich Text Editing**: Edit and format your transcribed text using a powerful rich text editor
- 📊 **Audio Visualization**: See your audio waveforms in real-time while recording
- 💾 **Local Storage**: All your notes are saved locally in your browser
- 🎨 **Modern UI**: Clean, responsive interface built with Tailwind CSS
- 🏃‍♂️ **Fast Performance**: Built with Vite for lightning-fast development and production builds

## 🛠️ Tech Stack

- React 18 with TypeScript
- Transformers.js for ML-powered speech recognition
- TinyMCE for rich text editing
- Tailwind CSS for styling
- React Audio Visualize for waveform display
- Vite for build tooling

## 🚀 Getting Started

1. Clone the repository:
```bash
git clone https://github.com/addyosmani/say.git
cd say
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. (Optional) Configure Dify Workflow integration:
   - Copy `.env.example` to `.env.local`
   - Add your Dify API key and configuration
   - See [Dify Configuration](#-dify-workflow-configuration) section below

5. Open your browser and navigate to `http://localhost:5173`

## 🏗️ Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory, ready for deployment.

## 📝 Scripts

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier

## 🔧 System Requirements

- Node.js 16 or higher
- Modern browser with WebAssembly support
- Microphone access for recording features

## 🔄 Dify Workflow Configuration

Say supports integration with [Dify](https://dify.ai/), a powerful LLM application development platform, allowing you to process audio through custom AI workflows.

### Setup

1. **Get your Dify API key**:
   - Sign up at [Dify](https://dify.ai/)
   - Create a workflow in your Dify dashboard
   - Get your API key from the API settings

2. **Configure the application**:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your configuration:
   ```env
   VITE_DIFY_API_KEY=your_dify_api_key_here
   VITE_DIFY_BASE_URL=https://api.dify.ai/v1
   VITE_DIFY_WORKFLOW_ID=your_workflow_id_here
   ```

3. **Using the Workflow feature**:
   - Record or upload an audio file
   - Click "Transcribe with Workflow" button
   - The audio will be uploaded to Dify and processed through your workflow
   - Results will be displayed in the interface

### Workflow Configuration

You can also configure Dify settings directly in the application:
- Expand the "Workflow Configuration" section
- Enter your API key, base URL, and workflow ID
- Settings are saved locally in your browser
- Use the "Download .env" button to save configuration as a file

### Supported Features

- ✅ File upload to Dify
- ✅ Workflow execution with blocking mode
- ✅ Real-time progress tracking
- ✅ Error handling and display
- ✅ Result visualization
- ✅ Custom workflow inputs

### API Documentation

For more information about Dify's API, refer to:
- [Workflow Execution](https://docs.dify.ai/api-reference/工作流执行/执行-workflow)
- [File Operations](https://docs.dify.ai/api-reference/文件操作-workflow/上传文件-workflow)
- [Getting Workflow Status](https://docs.dify.ai/api-reference/工作流执行/获取workflow执行情况)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details. Say builds on top of earlier demos of how to use Whisper with Transformers.js.

## TODO

- [ ] 1. 隐藏Workflow按钮
- [ ] 2. 将Whisper模型改为调用FunASR云端API
- [ ] 2.1 Flask API+FunASR实现实时、录音文件的转文字
- [ ] 2.2 调用Whisper的地方改为调用FunASR的API
- [ ] 3. 把录音的解析从实时输出结果改为后台解析，前台展示状态和结果
- [ ] 4. 调整Notes的存储方式和逻辑
- [ ] 5. 添加用户的识别及对应Notes
- [ ] 6. 微调TinyMCE的功能
- [ ] 7. 实现带格式的模版导入、调整后带格式的DOCX导出功能