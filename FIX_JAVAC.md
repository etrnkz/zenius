# 📱 Quick Fix for Fedora - Install javac

## You already have Java 25! Just need javac.

### Run this command:

```bash
sudo dnf install -y java-devel
```

This will install `javac` for your existing Java 25.

---

### If that doesn't work, try:

```bash
# Search for available Java packages
dnf search openjdk | grep devel

# Then install the available version (likely 21 or 25)
sudo dnf install -y java-21-openjdk-devel
# OR
sudo dnf install -y java-latest-openjdk-devel
```

---

### Verify:

```bash
javac -version
```

Should show: `javac 25.x.x` or `javac 21.x.x`

---

### Then build your APK:

```bash
cd /home/sud/Desktop/study-helper-ai-main
./scripts/build-apk.sh
```
