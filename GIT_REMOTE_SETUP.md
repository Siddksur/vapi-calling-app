# Setting Up Git Remote for GitHub

You need to connect your local repository to your GitHub repository.

---

## Option 1: If You Know Your GitHub Repo URL

If you know your GitHub repository URL (e.g., `https://github.com/yourusername/leadcallr-calling-app`):

```bash
# Add remote
git remote add origin https://github.com/yourusername/your-repo-name.git

# Verify it was added
git remote -v

# Push your code
git push -u origin main
```

---

## Option 2: Find Your Repo from Railway

1. **Go to Railway Dashboard**
2. **Click on your service** (`leadcallr-calling-app`)
3. **Go to "Settings" tab**
4. **Look for "Source" section**
5. **You should see your GitHub repository** linked there
6. **Copy the repository URL**

Then use Option 1 above with that URL.

---

## Option 3: Create New GitHub Repo

If you don't have a GitHub repo yet:

1. **Go to GitHub**: https://github.com/new
2. **Create a new repository**:
   - Name: `leadcallr-calling-app` (or your preferred name)
   - Make it **Private** (recommended for production apps)
   - **Don't** initialize with README (you already have code)
3. **Copy the repository URL** (e.g., `https://github.com/yourusername/leadcallr-calling-app.git`)
4. **Add remote**:
   ```bash
   git remote add origin https://github.com/yourusername/leadcallr-calling-app.git
   git push -u origin main
   ```

---

## Quick Commands

```bash
# Check if remote exists
git remote -v

# Add remote (replace with your URL)
git remote add origin https://github.com/yourusername/your-repo-name.git

# Verify
git remote -v

# Push code
git push -u origin main
```

---

## After Adding Remote

Once the remote is added, Railway will automatically deploy when you push!

