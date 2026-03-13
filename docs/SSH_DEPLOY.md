SSH key usage for AWS deployments

Overview
- This document shows minimal, safe steps to use an existing PEM key for SSH/SCP deployment to an AWS instance.
- Do NOT commit private keys. The repository now ignores `LightsailDefaultKey-us-east-1.pem`.

Prerequisites
- You have the private key file: LightsailDefaultKey-us-east-1.pem (placed outside any public repo if possible).
- Know the remote user (e.g., `ubuntu`, `ec2-user`, `bitnami`) and host IP or DNS (replace <HOST_IP>).

Unix / macOS (recommended)
1. Restrict permissions:

    chmod 600 LightsailDefaultKey-us-east-1.pem

2. SSH into the host:

    ssh -i LightsailDefaultKey-us-east-1.pem ubuntu@<HOST_IP>

3. Copy files (example: copy `backend/` to remote `/home/ubuntu/app`):

    scp -i LightsailDefaultKey-us-east-1.pem -r ./backend ubuntu@<HOST_IP>:/home/ubuntu/app

4. Run a remote deploy script (if you have one locally to stream):

    ssh -i LightsailDefaultKey-us-east-1.pem ubuntu@<HOST_IP> 'bash -s' < scripts/deploy_to_server.sh -- -n

PowerShell / Windows
1. Restrict file access (PowerShell):

    icacls LightsailDefaultKey-us-east-1.pem /inheritance:r
    icacls LightsailDefaultKey-us-east-1.pem /grant:r "%USERNAME%:R"

2. SSH / SCP (use Windows OpenSSH or PuTTY-compatible tools). Example with PowerShell OpenSSH:

    scp -i LightsailDefaultKey-us-east-1.pem -r .\backend ubuntu@<HOST_IP>:/home/ubuntu/app
    type scripts\deploy_to_server.sh | ssh -i LightsailDefaultKey-us-east-1.pem ubuntu@<HOST_IP> 'bash -s' -- -n

Notes & safety
- Never commit `LightsailDefaultKey-us-east-1.pem` to version control. It is already added to `.gitignore`.
- Store keys in a secure vault (AWS Secrets Manager, 1Password, or local encrypted store) for production.
- Use instance-specific users and consider deploying with CI/CD agents that hold keys outside the repo.

Optional: Make a helper script
- You can create a small helper script `scripts/ssh_deploy_helper.sh` that wraps `scp` and `ssh -i` with the correct user/host.

If you want, I can:
- add `scripts/ssh_deploy_helper.sh` that accepts `-i <key>` and `-h <host>`, or
- update the repository to use environment variables for host/user and run a single helper deploy command.
