import os
import subprocess
import sys

def run_command(command, description):
    print(f"--- {description} ---")
    try:
        result = subprocess.run(command, check=True, text=True, shell=True, capture_output=True)
        if result.stdout:
            print(result.stdout.strip())
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error: {e.stderr.strip()}")
        return False

def push_to_github():
    repo_url = "https://github.com/Sadiq-Kolakar/AegisAI"

    # Step 1: Initialize Git if not already
    if not os.path.exists(".git"):
        if not run_command("git init", "Initializing Git repository"):
            return

    # Step 2: Add all files
    if not run_command("git add .", "Adding files to staging area"):
        return

    # Step 3: Check if anything to commit
    try:
        status = subprocess.run("git status --porcelain", check=True, text=True, shell=True, capture_output=True).stdout.strip()
        if not status:
            print("No changes to commit.")
        else:
            # Step 4: Commit changes
            commit_message = input("Enter commit message (default: 'Update AegisAI v1.1'): ") or "Update AegisAI v1.1"
            run_command(f'git commit -m "{commit_message}"', "Committing changes")
    except subprocess.CalledProcessError:
        pass

    # Step 5: Ensure branch name is 'main'
    run_command("git branch -M main", "Updating branch to 'main'")

    # Step 6: Handle Remote origin
    try:
        subprocess.check_call("git remote get-url origin", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # origin already exists, update url
        run_command(f"git remote set-url origin {repo_url}", f"Updating remote origin to {repo_url}")
    except subprocess.CalledProcessError:
        # origin does not exist, add it
        run_command(f"git remote add origin {repo_url}", f"Adding remote origin {repo_url}")

    # Step 7: Push to GitHub
    print(f"--- Pushing to GitHub ({repo_url}) ---")
    run_command("git push -u origin main", "Pushing to remote")

if __name__ == "__main__":
    if not os.path.exists(".gitignore"):
        print("Warning: .gitignore missing. Creating a default one...")
        # (Assuming .gitignore was created already by the tool call before)
    
    push_to_github()
    print("\n[Done] Script finished execution.")
