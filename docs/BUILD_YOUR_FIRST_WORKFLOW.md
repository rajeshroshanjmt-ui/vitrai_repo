# BUILD YOUR FIRST WORKFLOW - COMPLETE TUTORIAL

## 🎯 Objective: Create a Customer Support Chatbot

**Time Required:** 15 minutes
**Skill Level:** Beginner
**Result:** Fully functional AI chatbot powered by LLM

---

## ✅ PRE-REQUISITES

- ✅ Access to Vetrai platform: `http://localhost`
- ✅ Demo account credentials (choose one):
  - **Admin:** `admin@vetrai.com` / `Admin@12345`
  - **Editor:** `editor@vetrai.com` / `Editor@12345`
  - **Viewer:** `viewer@vetrai.com` / `Viewer@12345`
- ✅ 5 minutes of free time
- ✅ Basic understanding of chatbots

---

## 📋 STEP-BY-STEP GUIDE

### STEP 1: Login to Vetrai

1. Open your browser
2. Go to: `http://localhost`
3. You see the login page
4. Enter credentials:
   - Email: `admin@demo.local`
   - Password: `Admin@12345`
5. Click "Sign In"
6. **Expected:** You're on the Dashboard

---

### STEP 2: Navigate to Chatflows

1. Look at the left sidebar
2. Click on **"Chatflows"** (or 💬 icon)
3. You see the Chatflows page
4. Click **"Create New"** or **"+" button**
5. **Expected:** New Chatflow creation dialog appears

---

### STEP 3: Name Your Chatflow

1. Dialog asks: "Chatflow Name"
2. Enter: `Customer Support Bot`
3. Click "Create" or "Next"
4. **Expected:** Canvas opens with empty workflow

---

### STEP 4: Add LLM Node (The Brain)

**Canvas Layout:**
- Left side: Node library
- Center: Workflow canvas
- Right side: Node properties

**Steps:**
1. Look for "Chat Models" section in left panel
2. Expand "Chat Models"
3. You see options:
   - Ollama Chat (Local)
   - OpenAI Chat (API)
   - Anthropic Chat (API)
4. Drag **"Ollama Chat"** to canvas
5. **Expected:** Green node appears on canvas

---

### STEP 5: Configure LLM Node

1. Click on the Ollama Chat node
2. Right panel shows settings:
   - **Model:** `llama2` or similar
   - **Temperature:** 0.7
   - **Max Tokens:** 2000
3. Settings are OK as-is, no changes needed
4. **Expected:** Node is configured and ready

---

### STEP 6: Add Input Node (Where Users Type)

1. Look for "Input/Output" section in left panel
2. Drag **"Chat Input"** node to canvas
3. Position it to the left of Ollama Chat node
4. **Expected:** Blue input node appears

---

### STEP 7: Add Output Node (Show Response)

1. Still in "Input/Output" section
2. Drag **"Chat Output"** node to canvas
3. Position it to the right of Ollama Chat node
4. **Expected:** Yellow output node appears

---

### STEP 8: Connect the Nodes

**Three connections to make:**

**Connection 1: Input → LLM**
1. Click output dot on Chat Input node
2. Drag to input dot on Ollama Chat node
3. Release to connect
4. **Expected:** Green line connects them

**Connection 2: LLM → Output**
1. Click output dot on Ollama Chat node
2. Drag to input dot on Chat Output node
3. Release to connect
4. **Expected:** Green line connects them

**Connection 3: Chat History (Optional)**
1. Right-click on Ollama Chat node
2. Select "Add Memory" if available
3. Or keep it simple without memory for now

---

### STEP 9: Save Your Workflow

1. Look for "Save" button (top of canvas)
2. Click **"Save"** or **"Save Workflow"**
3. Confirm save
4. **Expected:** Notification "Workflow saved"

---

### STEP 10: Test Your Chatbot

1. Look for "Test" or "Run" button
2. Click to open test interface
3. Type a message: `Hello! I need help with my order`
4. Press Enter or click Send
5. **Wait 5-10 seconds** for response
6. **Expected:**
   - Chatbot responds
   - You see: "Your order is being processed. You can track it here..."

---

### STEP 11: Enhance with System Prompt

1. Click on Ollama Chat node again
2. Look for "System Prompt" field
3. Add instructions:
   ```
   You are a helpful customer support agent for an e-commerce company.
   - Be friendly and professional
   - Help customers with orders, returns, and questions
   - If you don't know, suggest escalating to a human agent
   ```
4. Save workflow
5. Test again
6. **Expected:** Better, more relevant responses

---

### STEP 12: Add Document Context (RAG)

1. In left panel, find "Loaders" or "Documents"
2. Look for "Document Store" or "RAG"
3. You see options:
   - Create new Document Store
   - Use existing
4. Click to add Document Store node
5. Connect to Ollama Chat node
6. **Expected:** Document node added to workflow

---

### STEP 13: Add Custom Instructions

1. Click on Ollama Chat node
2. In properties panel, find "Custom Instructions"
3. Add:
   ```
   If the user asks about FAQ topics, use the provided knowledge base.
   If not in knowledge base, provide best guess and suggest human review.
   ```
4. Save workflow

---

### STEP 14: Test with Real Questions

Try these test queries:
1. **Simple:** `What's your return policy?`
2. **Complex:** `I bought item X on date Y, where is my order?`
3. **Troubleshoot:** `Your product doesn't work, how do I get a refund?`
4. **Follow-up:** `Can you tell me more about that?`

**Expected:** Chatbot handles each appropriately

---

### STEP 15: Deploy Your Chatbot

1. Look for "Deploy" button
2. Choose deployment option:
   - **Test Mode:** Test environment
   - **Production:** Live chatbot
3. For now, click **"Test Mode"**
4. You get a test link
5. **Expected:**
   - Shareable test URL
   - Chatbot is live on that URL

---

## 🎉 CONGRATULATIONS!

You've successfully built your first workflow! 🚀

**Your chatbot now:**
- ✅ Accepts user input
- ✅ Processes queries with LLM
- ✅ Returns intelligent responses
- ✅ Can be tested and improved

---

## 📈 NEXT IMPROVEMENTS

### Level 2: Add More Features

1. **Add Memory/Context:**
   - Enable conversation history
   - Chatbot remembers previous messages
   - Better follow-up conversations

2. **Add Tools:**
   - Database lookup tool
   - Order tracking tool
   - Email sending tool

3. **Add Error Handling:**
   - If answer uncertain, escalate
   - If user angry, offer human agent
   - If question outside scope, provide alternatives

---

### Level 3: Advanced Features

1. **Sentiment Analysis:**
   - Detect customer mood
   - Route angry customers to humans
   - Escalate negative interactions

2. **Multi-language:**
   - Detect language
   - Respond in customer's language
   - Support for 10+ languages

3. **Analytics:**
   - Track conversations
   - Measure satisfaction
   - Identify improvement areas

---

## 🔧 TROUBLESHOOTING

### Problem: Chatbot doesn't respond

**Solution:**
1. Check if Ollama service is running
2. Verify model is installed: `llama2`
3. Check console for errors
4. Try restarting backend

### Problem: Connection between nodes

**Solution:**
1. Make sure dots are visible
2. Click and drag properly
3. Check node is selected first
4. Try deleting and re-adding node

### Problem: Workflow won't save

**Solution:**
1. Check for validation errors (red icons)
2. Ensure all required fields filled
3. Try refreshing page
4. Contact support if issue persists

---

## 💡 QUICK TIPS

✅ **Start Simple:**
- Input → LLM → Output
- Add features gradually

✅ **Test Often:**
- Run after each change
- Verify behavior

✅ **Use Templates:**
- Browse Marketplace
- Start with pre-built flows
- Customize as needed

✅ **Read Documentation:**
- Check node descriptions
- Review example workflows
- Watch video tutorials

✅ **Ask for Help:**
- Use in-app help
- Check documentation
- Contact support

---

## 📚 RELATED WORKFLOWS TO BUILD NEXT

Now that you've mastered basic workflows, try:

1. **Workflow #2: Product Recommendation Bot**
   - Ask user preferences
   - Suggest products
   - Track which recommendations convert

2. **Workflow #3: Lead Qualification System**
   - Collect contact info
   - Ask qualifying questions
   - Score leads automatically

3. **Workflow #4: Content Generator**
   - Input topic
   - Generate blog post
   - Optimize for SEO

4. **Workflow #5: Data Analyzer**
   - Upload CSV file
   - Analyze data
   - Generate insights report

---

## 🎓 LEARNING RESOURCES

### Built-in Help
- Hover over any node for description
- Right-click for options
- Check "Help" section in sidebar

### Video Tutorials
- Dashboard has video links
- Each module has tutorial video
- 5-10 minute quick starts

### Documentation
- `/docs` - Complete API reference
- `README.md` - Project overview
- Example workflows in Marketplace

### Community
- Discord community
- GitHub discussions
- Stack Overflow tag: `vetrai`

---

## ✅ COMPLETION CHECKLIST

- [ ] Logged in successfully
- [ ] Created new chatflow
- [ ] Added Ollama Chat node
- [ ] Added Input node
- [ ] Added Output node
- [ ] Connected all nodes
- [ ] Saved workflow
- [ ] Tested with sample message
- [ ] Got response from chatbot
- [ ] Deployed to test environment
- [ ] Verified test link works

**Congratulations! You're now a Vetrai workflow builder!** 🎉

---

## 🚀 NEXT STEPS

### Immediate (Today):
1. Build 2-3 simple workflows
2. Test different LLM options
3. Explore marketplace templates

### This Week:
1. Build 5+ custom workflows
2. Integrate with APIs
3. Add tools and functions
4. Deploy to production

### This Month:
1. Build 20+ workflows
2. Create reusable templates
3. Train team members
4. Measure performance

---

## 📞 SUPPORT

- **Quick Questions:** In-app help
- **Documentation:** Check docs/
- **Issues:** GitHub issues
- **Community:** Discord
- **Email:** support@vetrai.tech

---

**Happy Building! 🚀**

Start creating workflows now: `http://localhost`
