#!/usr/bin/env python
"""
Server Manager

A utility script to manage the noteRAG server, ensuring clean start and stop operations.
This prevents port conflicts by properly cleaning up existing server processes.
"""
import subprocess
import psutil
import time
import sys
import os
import signal
import argparse

# Default server settings
DEFAULT_PORT = 3443
DEFAULT_SERVER_SCRIPT = "python_server/run.py"

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Manage the noteRAG server')
    parser.add_argument('action', choices=['start', 'stop', 'restart', 'status'], 
                      help='Action to perform on the server')
    parser.add_argument('--https', action='store_true', help='Use HTTPS (SSL)')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT, 
                      help=f'Port to run server on (default: {DEFAULT_PORT})')
    return parser.parse_args()

def find_server_processes(port=None):
    """Find running server processes, optionally filtering by port"""
    server_processes = []
    
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = proc.info['cmdline']
            if not cmdline:
                continue
                
            # Check if it's a Python process running our server scripts
            is_server = False
            for cmd in cmdline:
                if isinstance(cmd, str) and (
                    "python_server/run.py" in cmd or 
                    "start_server.py" in cmd or
                    "uvicorn" in cmd and "main:app" in " ".join(cmdline)
                ):
                    is_server = True
                    break
            
            # If port specified, check for that specific port
            if is_server and port:
                port_match = False
                for cmd in cmdline:
                    if isinstance(cmd, str) and f"--port {port}" in " ".join(cmdline):
                        port_match = True
                        break
                
                if not port_match and "--port" in " ".join(cmdline):
                    # This is a server but on a different port
                    continue
            
            if is_server:
                server_processes.append(proc)
                
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    return server_processes

def stop_server(port=None):
    """Stop any running server processes"""
    processes = find_server_processes(port)
    
    if not processes:
        print("No server processes found" + (f" on port {port}" if port else ""))
        return True
    
    print(f"Found {len(processes)} server process(es)" + (f" on port {port}" if port else ""))
    
    for proc in processes:
        try:
            # Try to kill the process gracefully first
            print(f"Stopping process {proc.info['pid']}...")
            proc.send_signal(signal.SIGTERM)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            print(f"Could not terminate process {proc.info['pid']} gracefully")
    
    # Wait for processes to terminate
    time.sleep(2)
    
    # Check if any are still running
    remaining = find_server_processes(port)
    if remaining:
        print(f"Forcefully terminating {len(remaining)} remaining process(es)...")
        for proc in remaining:
            try:
                proc.kill()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    
    # Final check
    time.sleep(1)
    if find_server_processes(port):
        print("Warning: Some processes could not be terminated")
        return False
    
    print("All server processes stopped successfully")
    return True

def start_server(use_https=False, port=DEFAULT_PORT):
    """Start the server with the specified configuration"""
    # Ensure no servers are running on this port
    stop_server(port)
    
    # Build the command
    cmd = ["python", DEFAULT_SERVER_SCRIPT]
    
    if use_https:
        cmd.append("--ssl")
    
    cmd.extend(["--port", str(port)])
    
    # Start the server
    print(f"Starting {'HTTPS' if use_https else 'HTTP'} server on port {port}...")
    
    # Start the server process and detach
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Wait briefly to check if the process starts correctly
    time.sleep(2)
    if process.poll() is not None:
        # Process terminated immediately
        stdout, stderr = process.communicate()
        print("Failed to start server:")
        print(stderr)
        return False
    
    print(f"Server started successfully on {'https' if use_https else 'http'}://localhost:{port}")
    return True

def check_server_status(port=None):
    """Check if any server processes are running"""
    processes = find_server_processes(port)
    
    if not processes:
        print("Server status: STOPPED")
        return False
    
    print(f"Server status: RUNNING ({len(processes)} process(es))")
    for proc in processes:
        try:
            cmdline = " ".join([cmd for cmd in proc.info['cmdline'] if cmd])
            print(f"PID {proc.info['pid']}: {cmdline}")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    
    return True

def main():
    """Main function"""
    args = parse_arguments()
    
    if args.action == 'start':
        start_server(args.https, args.port)
    elif args.action == 'stop':
        stop_server(args.port)
    elif args.action == 'restart':
        stop_server(args.port)
        start_server(args.https, args.port)
    elif args.action == 'status':
        check_server_status(args.port)

if __name__ == "__main__":
    main() 